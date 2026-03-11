import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listBuckets(client: S3Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListBucketsCommand({}))
    return (res.Buckets ?? []).map((b): CloudNode => ({
      id:       b.Name ?? 'unknown',
      type:     's3',
      label:    b.Name ?? 'Bucket',
      status:   'running',
      region,
      metadata: { creationDate: b.CreationDate },
    }))
  } catch {
    return []
  }
}
