import {
  S3Client,
  ListBucketsCommand,
  GetBucketNotificationConfigurationCommand,
  GetPublicAccessBlockCommand,
  GetBucketVersioningCommand
} from '@aws-sdk/client-s3'
import type { CloudNode, EdgeType } from '@riftview/shared'

export async function listBuckets(client: S3Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListBucketsCommand({}))
    const buckets = res.Buckets ?? []

    const enriched = await Promise.all(
      buckets.map(async (b): Promise<CloudNode> => {
        const name = b.Name ?? 'unknown'

        // Public access block
        let publicAccessEnabled = false
        const pabRes = await client
          .send(new GetPublicAccessBlockCommand({ Bucket: name }))
          .catch(() => null)
        if (!pabRes) {
          // No block config at all — bucket is publicly accessible
          publicAccessEnabled = true
        } else {
          const c = pabRes.PublicAccessBlockConfiguration ?? {}
          publicAccessEnabled = !(
            c.BlockPublicAcls &&
            c.BlockPublicPolicy &&
            c.RestrictPublicBuckets &&
            c.IgnorePublicAcls
          )
        }

        // Versioning status
        let versioningEnabled = false
        const versioningRes = await client
          .send(new GetBucketVersioningCommand({ Bucket: name }))
          .catch(() => null)
        if (versioningRes?.Status === 'Enabled') {
          versioningEnabled = true
        }

        const baseNode: CloudNode = {
          id: name,
          type: 'aws:s3',
          label: name,
          status: 'running',
          region,
          metadata: { creationDate: b.CreationDate, publicAccessEnabled, versioningEnabled }
        }

        const notifRes = await client
          .send(new GetBucketNotificationConfigurationCommand({ Bucket: name }))
          .catch(() => null)

        if (!notifRes) return baseNode

        const integrations: { targetId: string; edgeType: EdgeType }[] = [
          ...(notifRes.LambdaFunctionConfigurations ?? [])
            .filter(
              (c): c is typeof c & { LambdaFunctionArn: string } => c.LambdaFunctionArn != null
            )
            .map((c) => ({ targetId: c.LambdaFunctionArn, edgeType: 'trigger' as EdgeType })),
          ...(notifRes.QueueConfigurations ?? [])
            .filter((c): c is typeof c & { QueueArn: string } => c.QueueArn != null)
            .map((c) => ({ targetId: c.QueueArn, edgeType: 'trigger' as EdgeType })),
          ...(notifRes.TopicConfigurations ?? [])
            .filter((c): c is typeof c & { TopicArn: string } => c.TopicArn != null)
            .map((c) => ({ targetId: c.TopicArn, edgeType: 'trigger' as EdgeType }))
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
