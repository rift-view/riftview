import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EKSClient } from '@aws-sdk/client-eks'
import { listEksClusters } from '../../../../src/main/aws/services/eks'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as EKSClient

const CLUSTER_NAME = 'my-cluster'
const CLUSTER_ARN = 'arn:aws:eks:us-east-1:123456789:cluster/my-cluster'
const VPC_ID = 'vpc-abc123'
const ENDPOINT = 'https://ABCD.sk1.us-east-1.eks.amazonaws.com'

describe('listEksClusters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps EKS clusters to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({ clusters: [CLUSTER_NAME] })    // ListClusters
      .mockResolvedValueOnce({                                 // DescribeCluster
        cluster: {
          arn: CLUSTER_ARN,
          name: CLUSTER_NAME,
          status: 'ACTIVE',
          version: '1.29',
          endpoint: ENDPOINT,
          resourcesVpcConfig: { vpcId: VPC_ID },
        },
      })

    const nodes = await listEksClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('eks')
    expect(nodes[0].id).toBe(CLUSTER_ARN)
    expect(nodes[0].label).toBe(CLUSTER_NAME)
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores version and endpoint in metadata', async () => {
    mockSend
      .mockResolvedValueOnce({ clusters: [CLUSTER_NAME] })
      .mockResolvedValueOnce({
        cluster: {
          arn: CLUSTER_ARN,
          name: CLUSTER_NAME,
          status: 'ACTIVE',
          version: '1.29',
          endpoint: ENDPOINT,
          resourcesVpcConfig: { vpcId: VPC_ID },
        },
      })

    const nodes = await listEksClusters(mockClient, 'us-east-1')

    expect(nodes[0].metadata.version).toBe('1.29')
    expect(nodes[0].metadata.endpoint).toBe(ENDPOINT)
  })

  it('sets parentId from vpcId', async () => {
    mockSend
      .mockResolvedValueOnce({ clusters: [CLUSTER_NAME] })
      .mockResolvedValueOnce({
        cluster: {
          arn: CLUSTER_ARN,
          name: CLUSTER_NAME,
          status: 'ACTIVE',
          resourcesVpcConfig: { vpcId: VPC_ID },
        },
      })

    const nodes = await listEksClusters(mockClient, 'us-east-1')

    expect(nodes[0].parentId).toBe(VPC_ID)
  })

  it('paginates cluster listing across multiple pages', async () => {
    mockSend
      .mockResolvedValueOnce({ clusters: ['cluster-1'], nextToken: 'tok1' }) // page 1
      .mockResolvedValueOnce({ clusters: ['cluster-2'] })                    // page 2
      .mockResolvedValueOnce({ cluster: { arn: 'arn-1', name: 'cluster-1', status: 'ACTIVE', resourcesVpcConfig: {} } })
      .mockResolvedValueOnce({ cluster: { arn: 'arn-2', name: 'cluster-2', status: 'ACTIVE', resourcesVpcConfig: {} } })

    const nodes = await listEksClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.label)).toEqual(['cluster-1', 'cluster-2'])
  })

  it('falls back to cluster name as id/label when describe fails', async () => {
    mockSend
      .mockResolvedValueOnce({ clusters: [CLUSTER_NAME] })
      .mockRejectedValueOnce(new Error('Describe failed'))

    const nodes = await listEksClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(CLUSTER_NAME)
    expect(nodes[0].label).toBe(CLUSTER_NAME)
    expect(nodes[0].status).toBe('unknown')
  })

  it('maps CREATING/DELETING/FAILED statuses', async () => {
    const statuses: [string, string][] = [
      ['CREATING', 'creating'],
      ['DELETING', 'deleting'],
      ['FAILED', 'error'],
    ]

    for (const [awsStatus, expected] of statuses) {
      vi.clearAllMocks()
      mockSend
        .mockResolvedValueOnce({ clusters: [CLUSTER_NAME] })
        .mockResolvedValueOnce({ cluster: { arn: CLUSTER_ARN, name: CLUSTER_NAME, status: awsStatus, resourcesVpcConfig: {} } })

      const nodes = await listEksClusters(mockClient, 'us-east-1')
      expect(nodes[0].status).toBe(expected)
    }
  })

  it('returns empty array on top-level list error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Access denied'))

    const nodes = await listEksClusters(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
