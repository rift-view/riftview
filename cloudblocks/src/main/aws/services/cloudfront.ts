import {
  CloudFrontClient,
  ListDistributionsCommand,
} from '@aws-sdk/client-cloudfront'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function cfStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'Deployed')   return 'running'
  if (status === 'InProgress') return 'pending'
  if (status === 'Failed')     return 'error'
  return 'unknown'
}

function originType(domainName: string): 'S3' | 'custom' {
  if (domainName.includes('.s3.amazonaws.com') || domainName.includes('.s3-website-')) return 'S3'
  return 'custom'
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

      return {
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
    })
  } catch {
    return []
  }
}
