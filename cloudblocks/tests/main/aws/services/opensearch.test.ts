import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenSearchClient } from '@aws-sdk/client-opensearch'
import { listOpenSearchDomains } from '../../../../src/main/aws/services/opensearch'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as OpenSearchClient

const DOMAIN_ARN = 'arn:aws:es:us-east-1:123456789012:domain/my-domain'
const VPC_ID     = 'vpc-abc123'

describe('listOpenSearchDomains', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a domain to a CloudNode', async () => {
    mockSend
      .mockResolvedValueOnce({ DomainNames: [{ DomainName: 'my-domain' }] })  // ListDomainNames
      .mockResolvedValueOnce({                                                  // DescribeDomains
        DomainStatusList: [{
          ARN:                   DOMAIN_ARN,
          DomainName:            'my-domain',
          DomainProcessingStatus: 'Active',
          EngineVersion:         'OpenSearch_2.3',
          Endpoint:              'search-my-domain.us-east-1.es.amazonaws.com',
        }],
      })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('opensearch')
    expect(nodes[0].id).toBe(DOMAIN_ARN)
    expect(nodes[0].label).toBe('my-domain')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores engineVersion and endpoint in metadata', async () => {
    mockSend
      .mockResolvedValueOnce({ DomainNames: [{ DomainName: 'my-domain' }] })
      .mockResolvedValueOnce({
        DomainStatusList: [{
          ARN:                    DOMAIN_ARN,
          DomainName:             'my-domain',
          DomainProcessingStatus: 'Active',
          EngineVersion:          'OpenSearch_2.3',
          Endpoint:               'search-my-domain.us-east-1.es.amazonaws.com',
        }],
      })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes[0].metadata.engineVersion).toBe('OpenSearch_2.3')
    expect(nodes[0].metadata.endpoint).toBe('search-my-domain.us-east-1.es.amazonaws.com')
  })

  it('sets parentId from VPCOptions.VPCId', async () => {
    mockSend
      .mockResolvedValueOnce({ DomainNames: [{ DomainName: 'my-domain' }] })
      .mockResolvedValueOnce({
        DomainStatusList: [{
          ARN:                    DOMAIN_ARN,
          DomainName:             'my-domain',
          DomainProcessingStatus: 'Active',
          VPCOptions:             { VPCId: VPC_ID },
          Endpoints:              { vpc: 'vpc-endpoint.us-east-1.es.amazonaws.com' },
        }],
      })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes[0].parentId).toBe(VPC_ID)
    expect(nodes[0].metadata.endpoint).toBe('vpc-endpoint.us-east-1.es.amazonaws.com')
  })

  it('falls back to VPC endpoint when top-level Endpoint is absent', async () => {
    mockSend
      .mockResolvedValueOnce({ DomainNames: [{ DomainName: 'my-domain' }] })
      .mockResolvedValueOnce({
        DomainStatusList: [{
          ARN:                    DOMAIN_ARN,
          DomainName:             'my-domain',
          DomainProcessingStatus: 'Active',
          Endpoint:               undefined,
          Endpoints:              { vpc: 'vpc-ep.us-east-1.es.amazonaws.com' },
        }],
      })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes[0].metadata.endpoint).toBe('vpc-ep.us-east-1.es.amazonaws.com')
  })

  it.each([
    ['Active',   'running'],
    ['Creating', 'creating'],
    ['Deleting', 'deleting'],
    ['Failed',   'error'],
    ['Modifying','unknown'],
  ])('maps DomainProcessingStatus %s to node status %s', async (processingStatus, expectedStatus) => {
    mockSend
      .mockResolvedValueOnce({ DomainNames: [{ DomainName: 'my-domain' }] })
      .mockResolvedValueOnce({
        DomainStatusList: [{
          ARN:                    DOMAIN_ARN,
          DomainName:             'my-domain',
          DomainProcessingStatus: processingStatus,
        }],
      })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes[0].status).toBe(expectedStatus)
  })

  it('returns empty array when no domains exist', async () => {
    mockSend.mockResolvedValueOnce({ DomainNames: [] })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
    expect(mockSend).toHaveBeenCalledTimes(1)  // DescribeDomains should not be called
  })

  it('returns empty array on top-level error', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })

  it('uses DomainName as id when ARN is missing', async () => {
    mockSend
      .mockResolvedValueOnce({ DomainNames: [{ DomainName: 'my-domain' }] })
      .mockResolvedValueOnce({
        DomainStatusList: [{
          ARN:                    undefined,
          DomainName:             'my-domain',
          DomainProcessingStatus: 'Active',
        }],
      })

    const nodes = await listOpenSearchDomains(mockClient, 'us-east-1')

    expect(nodes[0].id).toBe('my-domain')
  })
})
