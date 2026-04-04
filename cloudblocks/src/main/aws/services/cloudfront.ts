import {
  CloudFrontClient,
  ListDistributionsCommand,
} from '@aws-sdk/client-cloudfront'
import type { CloudNode, EdgeType, NodeStatus } from '../../../renderer/types/cloud'

function cfStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'Deployed')   return 'running'
  if (status === 'InProgress') return 'pending'
  if (status === 'Failed')     return 'error'
  return 'unknown'
}

function originType(domainName: string): 'ALB' | 'APIGW' | 'S3' | 'custom' {
  // Covers: bucket.s3.amazonaws.com, bucket.s3.REGION.amazonaws.com, bucket.s3-website-REGION.amazonaws.com
  if (/\.s3[.-]/.test(domainName) && domainName.endsWith('.amazonaws.com')) return 'S3'
  if (/\.elb\.amazonaws\.com$/.test(domainName)) return 'ALB'
  if (/\.execute-api\.[^.]+\.amazonaws\.com$/.test(domainName)) return 'APIGW'
  return 'custom'
}

// Extract S3 bucket name from domain like "my-bucket.s3.amazonaws.com"
function s3BucketName(domainName: string): string {
  return domainName.split('.s3')[0]
}

export async function listDistributions(client: CloudFrontClient): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListDistributionsCommand({}))
    const items = res.DistributionList?.Items ?? []

    return items.map((dist): CloudNode => {
      const origins = (dist.Origins?.Items ?? []).map((o) => ({
        id:         o.Id ?? '',
        domainName: o.DomainName ?? '',
        type:       originType(o.DomainName ?? ''),
      }))

      const certArn = dist.ViewerCertificate?.ACMCertificateArn

      const integrations: { targetId: string; edgeType: EdgeType }[] = [
        ...origins
          .filter((o) => o.type === 'S3')
          .map((o) => ({ targetId: s3BucketName(o.domainName), edgeType: 'origin' as EdgeType })),
        ...origins
          .filter((o) => o.type === 'ALB' || o.type === 'APIGW')
          .map((o) => ({ targetId: o.domainName, edgeType: 'origin' as EdgeType })),
        // ACM certificate used by this distribution
        ...(certArn ? [{ targetId: certArn, edgeType: 'origin' as EdgeType }] : []),
      ]

      const node: CloudNode = {
        id:     dist.Id ?? 'unknown',
        type:   'cloudfront',
        label:  dist.Comment || dist.DomainName || dist.Id || 'CloudFront',
        status: cfStatusToNodeStatus(dist.Status),
        region: 'global',
        metadata: {
          domainName:        dist.DomainName ?? '',
          origins,
          certArn:           certArn ?? undefined,
          priceClass:        dist.PriceClass ?? 'PriceClass_All',
        },
      }

      return integrations.length > 0 ? { ...node, integrations } : node
    })
  } catch {
    return []
  }
}
