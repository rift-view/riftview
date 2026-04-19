import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'
import { listDistributions } from '../../../../src/main/aws/services/cloudfront'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as CloudFrontClient

const DIST = {
  Id: 'E1ABC123',
  DomainName: 'abc123.cloudfront.net',
  Status: 'Deployed',
  Comment: 'My CDN',
  PriceClass: 'PriceClass_100',
  ViewerCertificate: {},
  Origins: { Items: [] }
}

describe('listDistributions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps distributions to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [DIST] } })

    const nodes = await listDistributions(mockClient)

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('E1ABC123')
    expect(nodes[0].type).toBe('cloudfront')
    expect(nodes[0].region).toBe('global')
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('emits origin integration for S3 origins', async () => {
    const dist = {
      ...DIST,
      Origins: {
        Items: [
          { Id: 'my-bucket', DomainName: 'my-bucket.s3.amazonaws.com' },
          { Id: 'regional', DomainName: 'my-bucket.s3.us-east-1.amazonaws.com' },
          { Id: 'website', DomainName: 'my-bucket.s3-website-us-east-1.amazonaws.com' },
          { Id: 'api', DomainName: 'api.example.com' } // custom — should be excluded
        ]
      }
    }
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [dist] } })

    const nodes = await listDistributions(mockClient)

    expect(nodes[0].integrations).toHaveLength(3)
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'origin')).toBe(true)
    expect(nodes[0].integrations?.every((i) => i.targetId === 'my-bucket')).toBe(true)
  })

  it('does not attach integrations when no S3 origins', async () => {
    const dist = {
      ...DIST,
      Origins: { Items: [{ Id: 'api', DomainName: 'api.example.com' }] }
    }
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [dist] } })

    const nodes = await listDistributions(mockClient)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))
    const nodes = await listDistributions(mockClient)
    expect(nodes).toEqual([])
  })

  it('emits origin integration for ALB origins with raw domain as targetId', async () => {
    const dist = {
      ...DIST,
      Origins: {
        Items: [{ Id: 'alb-origin', DomainName: 'my-alb-1234567890.us-east-1.elb.amazonaws.com' }]
      }
    }
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [dist] } })

    const nodes = await listDistributions(mockClient)

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0].edgeType).toBe('origin')
    expect(nodes[0].integrations?.[0].targetId).toBe(
      'my-alb-1234567890.us-east-1.elb.amazonaws.com'
    )
  })

  it('emits origin integration for APIGW origins with raw domain as targetId', async () => {
    const dist = {
      ...DIST,
      Origins: {
        Items: [{ Id: 'apigw-origin', DomainName: 'abc123def.execute-api.us-east-1.amazonaws.com' }]
      }
    }
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [dist] } })

    const nodes = await listDistributions(mockClient)

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0].edgeType).toBe('origin')
    expect(nodes[0].integrations?.[0].targetId).toBe(
      'abc123def.execute-api.us-east-1.amazonaws.com'
    )
  })

  it('handles mixed origins: S3 gets bucket name, ALB gets domain, custom excluded', async () => {
    const dist = {
      ...DIST,
      Origins: {
        Items: [
          { Id: 's3-origin', DomainName: 'my-bucket.s3.amazonaws.com' },
          { Id: 'alb-origin', DomainName: 'my-alb.us-east-1.elb.amazonaws.com' },
          { Id: 'custom-origin', DomainName: 'api.example.com' }
        ]
      }
    }
    mockSend.mockResolvedValueOnce({ DistributionList: { Items: [dist] } })

    const nodes = await listDistributions(mockClient)

    expect(nodes[0].integrations).toHaveLength(2)
    const targetIds = nodes[0].integrations?.map((i) => i.targetId) ?? []
    expect(targetIds).toContain('my-bucket')
    expect(targetIds).toContain('my-alb.us-east-1.elb.amazonaws.com')
    expect(targetIds).not.toContain('api.example.com')
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'origin')).toBe(true)
  })
})
