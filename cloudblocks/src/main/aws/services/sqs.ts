import { SQSClient, ListQueuesCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { LambdaClient, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listQueues(client: SQSClient, lambdaClient: LambdaClient, region: string): Promise<CloudNode[]> {
  const nodes = await scanFlatService(client, region, {
    fetch: async (c) => {
      const urls: string[] = []
      let nextToken: string | undefined
      do {
        const res = await c.send(new ListQueuesCommand({ NextToken: nextToken }))
        urls.push(...(res.QueueUrls ?? []))
        nextToken = res.NextToken
      } while (nextToken)
      return urls
    },
    map: (url, region): CloudNode => ({
      id:       url,
      type:     'sqs',
      label:    url.split('/').pop() ?? url,
      status:   'running',
      region,
      metadata: {},
    }),
  })

  const enriched = await Promise.all(
    nodes.map(async (node): Promise<CloudNode> => {
      const attrRes = await client
        .send(new GetQueueAttributesCommand({ QueueUrl: node.id, AttributeNames: ['QueueArn', 'ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'] }))
        .catch((): { Attributes: Record<string, string> } => ({ Attributes: {} }))

      const queueArn = attrRes.Attributes?.['QueueArn']
      if (!queueArn) return node

      const mappingRes = await lambdaClient
        .send(new ListEventSourceMappingsCommand({ EventSourceArn: queueArn }))
        .catch(() => ({ EventSourceMappings: [] }))

      const integrations = (mappingRes.EventSourceMappings ?? [])
        .filter((m): m is typeof m & { FunctionArn: string } => m.FunctionArn != null)
        .map((m): { targetId: string; edgeType: EdgeType } => ({
          targetId: m.FunctionArn,
          edgeType: 'trigger',
        }))

      const msgs = attrRes.Attributes?.['ApproximateNumberOfMessages']
      const inFlight = attrRes.Attributes?.['ApproximateNumberOfMessagesNotVisible']
      const enrichedNode: CloudNode = {
        ...node,
        id: queueArn,
        metadata: {
          ...(msgs != null ? { messages: Number(msgs) } : {}),
          ...(inFlight != null ? { inFlight: Number(inFlight) } : {}),
        },
      }
      return integrations.length > 0 ? { ...enrichedNode, integrations } : enrichedNode
    })
  )

  return enriched
}
