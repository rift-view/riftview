import {
  CreateDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  DeleteDistributionCommand,
  GetDistributionCommand,
  CreateInvalidationCommand,
  type PriceClass
} from '@aws-sdk/client-cloudfront'
import type { AwsClients } from '../client'

export interface CreateDistributionParams {
  comment: string
  origins: Array<{ id: string; domainName: string }>
  defaultRootObject: string
  certArn?: string
  priceClass: string
}

export interface UpdateDistributionParams {
  comment?: string
  defaultRootObject?: string
  certArn?: string
  priceClass?: string
}

export async function cfCreateDistribution(
  clients: AwsClients,
  params: CreateDistributionParams
): Promise<void> {
  const origins = params.origins.map((o) => ({
    Id: o.id,
    DomainName: o.domainName,
    S3OriginConfig: { OriginAccessIdentity: '' }
  }))
  const viewerCertificate = params.certArn
    ? {
        ACMCertificateArn: params.certArn,
        SSLSupportMethod: 'sni-only' as const,
        MinimumProtocolVersion: 'TLSv1.2_2021' as const
      }
    : { CloudFrontDefaultCertificate: true }

  await clients.cloudfront.send(
    new CreateDistributionCommand({
      DistributionConfig: {
        CallerReference: Date.now().toString(),
        Comment: params.comment,
        DefaultRootObject: params.defaultRootObject,
        PriceClass: params.priceClass as PriceClass,
        Enabled: true,
        Origins: { Quantity: origins.length, Items: origins },
        DefaultCacheBehavior: {
          TargetOriginId: params.origins[0]?.id ?? 'default',
          ViewerProtocolPolicy: 'redirect-to-https',
          CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
          AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] }
        },
        ViewerCertificate: viewerCertificate
      }
    })
  )
}

export async function cfUpdateDistribution(
  clients: AwsClients,
  id: string,
  params: UpdateDistributionParams
): Promise<void> {
  const configRes = await clients.cloudfront.send(new GetDistributionConfigCommand({ Id: id }))
  const config = configRes.DistributionConfig
  const etag = configRes.ETag
  if (!config || !etag) throw new Error('Could not fetch distribution config')

  if (params.comment !== undefined) config.Comment = params.comment
  if (params.defaultRootObject !== undefined) config.DefaultRootObject = params.defaultRootObject
  if (params.priceClass !== undefined) config.PriceClass = params.priceClass as PriceClass
  if (params.certArn !== undefined) {
    config.ViewerCertificate = params.certArn
      ? {
          ACMCertificateArn: params.certArn,
          SSLSupportMethod: 'sni-only',
          MinimumProtocolVersion: 'TLSv1.2_2021'
        }
      : { CloudFrontDefaultCertificate: true }
  }

  await clients.cloudfront.send(
    new UpdateDistributionCommand({ Id: id, IfMatch: etag, DistributionConfig: config })
  )
}

export async function cfDeleteDistribution(clients: AwsClients, id: string): Promise<void> {
  const configRes = await clients.cloudfront.send(new GetDistributionConfigCommand({ Id: id }))
  const config = configRes.DistributionConfig
  let etag = configRes.ETag
  if (!config || !etag) throw new Error('Could not fetch distribution config')

  if (config.Enabled) {
    config.Enabled = false
    const updateRes = await clients.cloudfront.send(
      new UpdateDistributionCommand({ Id: id, IfMatch: etag, DistributionConfig: config })
    )
    etag = updateRes.ETag

    let deployed = false
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const statusRes = await clients.cloudfront.send(new GetDistributionCommand({ Id: id }))
      etag = statusRes.ETag ?? etag
      if (statusRes.Distribution?.Status === 'Deployed') {
        deployed = true
        break
      }
    }
    if (!deployed) throw new Error('Timeout waiting for distribution to disable')
  }

  await clients.cloudfront.send(new DeleteDistributionCommand({ Id: id, IfMatch: etag }))
}

export async function cfCreateInvalidation(
  clients: AwsClients,
  distributionId: string,
  cfPath: string
): Promise<void> {
  await clients.cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        Paths: { Quantity: 1, Items: [cfPath] },
        CallerReference: Date.now().toString()
      }
    })
  )
}
