import {
  KinesisClient,
  ListStreamsCommand,
} from '@aws-sdk/client-kinesis'
import type { CloudNode } from '../../../renderer/types/cloud'

function kinesisStatusToNodeStatus(status: string | undefined): import('../../../renderer/types/cloud').NodeStatus {
  if (status === 'ACTIVE') return 'running'
  if (status === 'CREATING') return 'pending'
  if (status === 'DELETING') return 'pending'
  return 'unknown'
}

export async function listStreams(client: KinesisClient, region: string): Promise<CloudNode[]> {
  try {
    const nodes: CloudNode[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new ListStreamsCommand({ NextToken: nextToken }))
      for (const summary of res.StreamSummaries ?? []) {
        if (!summary.StreamARN) continue
        nodes.push({
          id:       summary.StreamARN,
          type:     'kinesis',
          label:    summary.StreamName ?? summary.StreamARN,
          status:   kinesisStatusToNodeStatus(summary.StreamStatus),
          region,
          metadata: { streamName: summary.StreamName, streamArn: summary.StreamARN, streamMode: summary.StreamModeDetails?.StreamMode ?? 'PROVISIONED' },
        })
      }
      nextToken = res.NextToken
    } while (nextToken)
    return nodes
  } catch {
    return []
  }
}
