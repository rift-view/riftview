import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KafkaClient } from '@aws-sdk/client-kafka'
import { listMskClusters } from '../../../../src/main/aws/services/msk'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as KafkaClient

const CLUSTER_ARN = 'arn:aws:kafka:us-east-1:123456789:cluster/my-cluster/abc'
const SUBNET_ID = 'subnet-abc123'

describe('listMskClusters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps provisioned MSK clusters to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      ClusterInfoList: [{
        ClusterArn: CLUSTER_ARN,
        ClusterName: 'my-cluster',
        State: 'ACTIVE',
        ClusterType: 'PROVISIONED',
        Provisioned: {
          BrokerNodeGroupInfo: {
            InstanceType: 'kafka.m5.large',
            ClientSubnets: [SUBNET_ID],
          },
        },
      }],
    })

    const nodes = await listMskClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('msk')
    expect(nodes[0].id).toBe(CLUSTER_ARN)
    expect(nodes[0].label).toBe('my-cluster')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores clusterType and instanceType in metadata', async () => {
    mockSend.mockResolvedValueOnce({
      ClusterInfoList: [{
        ClusterArn: CLUSTER_ARN,
        ClusterName: 'my-cluster',
        State: 'ACTIVE',
        ClusterType: 'PROVISIONED',
        Provisioned: {
          BrokerNodeGroupInfo: { InstanceType: 'kafka.m5.large', ClientSubnets: [] },
        },
      }],
    })

    const nodes = await listMskClusters(mockClient, 'us-east-1')

    expect(nodes[0].metadata.clusterType).toBe('PROVISIONED')
    expect(nodes[0].metadata.instanceType).toBe('kafka.m5.large')
  })

  it('sets parentId from first provisioned broker subnet', async () => {
    mockSend.mockResolvedValueOnce({
      ClusterInfoList: [{
        ClusterArn: CLUSTER_ARN,
        ClusterName: 'my-cluster',
        State: 'ACTIVE',
        Provisioned: {
          BrokerNodeGroupInfo: { ClientSubnets: [SUBNET_ID, 'subnet-other'] },
        },
      }],
    })

    const nodes = await listMskClusters(mockClient, 'us-east-1')

    expect(nodes[0].parentId).toBe(SUBNET_ID)
  })

  it('sets parentId from serverless VPC config when provisioned subnets absent', async () => {
    const SERVERLESS_SUBNET = 'subnet-serverless'
    mockSend.mockResolvedValueOnce({
      ClusterInfoList: [{
        ClusterArn: CLUSTER_ARN,
        ClusterName: 'my-cluster',
        State: 'ACTIVE',
        ClusterType: 'SERVERLESS',
        Serverless: {
          VpcConfigs: [{ SubnetIds: [SERVERLESS_SUBNET] }],
        },
      }],
    })

    const nodes = await listMskClusters(mockClient, 'us-east-1')

    expect(nodes[0].parentId).toBe(SERVERLESS_SUBNET)
  })

  it('paginates cluster listing', async () => {
    const CLUSTER_ARN_2 = 'arn:aws:kafka:us-east-1:123456789:cluster/cluster-2/xyz'
    mockSend
      .mockResolvedValueOnce({                                             // page 1
        ClusterInfoList: [{ ClusterArn: CLUSTER_ARN, ClusterName: 'cluster-1', State: 'ACTIVE' }],
        NextToken: 'tok1',
      })
      .mockResolvedValueOnce({                                             // page 2
        ClusterInfoList: [{ ClusterArn: CLUSTER_ARN_2, ClusterName: 'cluster-2', State: 'ACTIVE' }],
      })

    const nodes = await listMskClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.label)).toEqual(['cluster-1', 'cluster-2'])
  })

  it('maps CREATING/DELETING/FAILED statuses', async () => {
    const statuses: [string, string][] = [
      ['CREATING', 'creating'],
      ['DELETING', 'deleting'],
      ['FAILED', 'error'],
    ]

    for (const [awsStatus, expected] of statuses) {
      vi.clearAllMocks()
      mockSend.mockResolvedValueOnce({
        ClusterInfoList: [{ ClusterArn: CLUSTER_ARN, ClusterName: 'my-cluster', State: awsStatus }],
      })

      const nodes = await listMskClusters(mockClient, 'us-east-1')
      expect(nodes[0].status).toBe(expected)
    }
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Access denied'))

    const nodes = await listMskClusters(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
