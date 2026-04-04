import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand,
} from '@aws-sdk/client-acm'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function acmStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'ISSUED')              return 'running'
  if (status === 'PENDING_VALIDATION')  return 'pending'
  if (
    status === 'FAILED'   ||
    status === 'EXPIRED'  ||
    status === 'INACTIVE' ||
    status === 'REVOKED'
  ) return 'error'
  return 'unknown'
}

export async function listCertificates(client: ACMClient): Promise<CloudNode[]> {
  try {
    const summaries: { CertificateArn?: string }[] = []
    let nextToken: string | undefined
    do {
      const listRes = await client.send(new ListCertificatesCommand({ NextToken: nextToken }))
      summaries.push(...(listRes.CertificateSummaryList ?? []))
      nextToken = listRes.NextToken
    } while (nextToken)

    const nodes = await Promise.all(
      summaries.map(async (summary): Promise<CloudNode | null> => {
        const arn = summary.CertificateArn
        if (!arn) return null
        try {
          const detailRes = await client.send(new DescribeCertificateCommand({ CertificateArn: arn }))
          const cert = detailRes.Certificate
          if (!cert) return null

          const cnameRecords = (cert.DomainValidationOptions ?? [])
            .flatMap((opt) => {
              const rec = opt.ResourceRecord
              if (!rec || !rec.Name || !rec.Value) return []
              return [{ name: rec.Name, value: rec.Value }]
            })

          return {
            id:     arn,
            type:   'acm',
            label:  cert.DomainName ?? arn,
            status: acmStatusToNodeStatus(cert.Status),
            region: 'global',
            metadata: {
              domainName:              cert.DomainName ?? '',
              subjectAlternativeNames: cert.SubjectAlternativeNames ?? [],
              validationMethod:        cert.DomainValidationOptions?.[0]?.ValidationMethod ?? 'DNS',
              inUseBy:                 cert.InUseBy ?? [],
              cnameRecords,
            },
          }
        } catch {
          return null
        }
      }),
    )

    return nodes.filter((n): n is CloudNode => n !== null)
  } catch {
    return []
  }
}
