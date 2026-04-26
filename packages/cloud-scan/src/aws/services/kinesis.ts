import { KinesisClient, ListStreamsCommand } from '@aws-sdk/client-kinesis'
import { LambdaClient, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, EdgeType } from '@riftview/shared'

function kinesisStatusToNodeStatus(
  status: string | undefined
): import('@riftview/shared').NodeStatus {
  if (status === 'ACTIVE') return 'running'
  if (status === 'CREATING') return 'pending'
  if (status === 'DELETING') return 'pending'
  return 'unknown'
}

export async function listStreams(
  client: KinesisClient,
  lambdaClient: LambdaClient,
  region: string
): Promise<CloudNode[]> {
  try {
    const rawNodes: Omit<CloudNode, 'integrations'>[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new ListStreamsCommand({ NextToken: nextToken }))
      for (const summary of res.StreamSummaries ?? []) {
        if (!summary.StreamARN) continue
        rawNodes.push({
          id: summary.StreamARN,
          type: 'aws:kinesis',
          label: summary.StreamName ?? summary.StreamARN,
          status: kinesisStatusToNodeStatus(summary.StreamStatus),
          region,
          metadata: {
            streamName: summary.StreamName,
            streamArn: summary.StreamARN,
            streamMode: summary.StreamModeDetails?.StreamMode ?? 'PROVISIONED'
          }
        })
      }
      nextToken = res.NextToken
    } while (nextToken)

    const nodes = await Promise.all(
      rawNodes.map(async (baseNode): Promise<CloudNode> => {
        const mappingRes = await lambdaClient
          .send(new ListEventSourceMappingsCommand({ EventSourceArn: baseNode.id }))
          .catch(() => ({ EventSourceMappings: [] }))

        const integrations: { targetId: string; edgeType: EdgeType }[] = (
          mappingRes.EventSourceMappings ?? []
        )
          .filter((m): m is typeof m & { FunctionArn: string } => m.FunctionArn != null)
          .map((m) => ({ targetId: m.FunctionArn, edgeType: 'trigger' as EdgeType }))

        return integrations.length > 0 ? { ...baseNode, integrations } : baseNode
      })
    )

    return nodes
  } catch {
    return []
  }
}
