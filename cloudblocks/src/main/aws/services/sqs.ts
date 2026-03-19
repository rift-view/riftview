import { SQSClient, ListQueuesCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { LambdaClient, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listQueues(client: SQSClient, region: string): Promise<CloudNode[]> {
  const nodes = await scanFlatService(client, region, {
    fetch: async (c) => {
      const res = await c.send(new ListQueuesCommand({}))
      return res.QueueUrls ?? []
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

  const lambdaClient = new LambdaClient({ region })

  const enriched = await Promise.all(
    nodes.map(async (node): Promise<CloudNode> => {
      const attrRes = await client
        .send(new GetQueueAttributesCommand({ QueueUrl: node.id, AttributeNames: ['QueueArn'] }))
        .catch(() => ({ Attributes: {} }))

      const queueArn = attrRes.Attributes?.QueueArn
      if (!queueArn) return node

      const mappingRes = await lambdaClient
        .send(new ListEventSourceMappingsCommand({ EventSourceArn: queueArn }))
        .catch(() => ({ EventSourceMappings: [] }))

      const integrations = (mappingRes.EventSourceMappings ?? [])
        .filter((m) => m.FunctionArn != null)
        .map((m): { targetId: string; edgeType: EdgeType } => ({
          targetId: m.FunctionArn!,
          edgeType: 'trigger',
        }))

      return integrations.length > 0 ? { ...node, integrations } : node
    })
  )

  return enriched
}
