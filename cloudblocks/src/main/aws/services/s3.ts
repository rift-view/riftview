import {
  S3Client,
  ListBucketsCommand,
  GetBucketNotificationConfigurationCommand,
} from '@aws-sdk/client-s3'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

export async function listBuckets(client: S3Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListBucketsCommand({}))
    const buckets = res.Buckets ?? []

    const enriched = await Promise.all(
      buckets.map(async (b): Promise<CloudNode> => {
        const name = b.Name ?? 'unknown'
        const baseNode: CloudNode = {
          id: name,
          type: 's3',
          label: name,
          status: 'running',
          region,
          metadata: { creationDate: b.CreationDate },
        }

        const notifRes = await client
          .send(new GetBucketNotificationConfigurationCommand({ Bucket: name }))
          .catch(() => null)

        if (!notifRes) return baseNode

        const integrations: { targetId: string; edgeType: EdgeType }[] = [
          ...(notifRes.LambdaFunctionConfigurations ?? [])
            .filter((c): c is typeof c & { LambdaFunctionArn: string } => c.LambdaFunctionArn != null)
            .map((c) => ({ targetId: c.LambdaFunctionArn, edgeType: 'trigger' as EdgeType })),
          ...(notifRes.QueueConfigurations ?? [])
            .filter((c): c is typeof c & { QueueArn: string } => c.QueueArn != null)
            .map((c) => ({ targetId: c.QueueArn, edgeType: 'trigger' as EdgeType })),
          ...(notifRes.TopicConfigurations ?? [])
            .filter((c): c is typeof c & { TopicArn: string } => c.TopicArn != null)
            .map((c) => ({ targetId: c.TopicArn, edgeType: 'trigger' as EdgeType })),
        ]

        return integrations.length > 0 ? { ...baseNode, integrations } : baseNode
      })
    )

    return enriched
  } catch (err) {
    console.error('[s3] listBuckets failed:', err)
    return []
  }
}
