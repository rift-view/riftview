import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ECSClient } from '@aws-sdk/client-ecs'
import { listEcsServices } from '../../../../src/main/aws/services/ecs'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ECSClient

const CLUSTER_ARN = 'arn:aws:ecs:us-east-1:123456789:cluster/my-cluster'
const SERVICE_ARN = 'arn:aws:ecs:us-east-1:123456789:service/my-cluster/my-svc'
const SUBNET_ID = 'subnet-abc123'
const TG_ARN = 'arn:aws:elasticloadbalancing:us-east-1:123456789:targetgroup/my-tg/abc'
const ECR_IMAGE = '123456789.dkr.ecr.us-east-1.amazonaws.com/my-repo:latest'
const ECR_REPO_URI = '123456789.dkr.ecr.us-east-1.amazonaws.com/my-repo'

const TASK_DEF_ARN = 'arn:aws:ecs:us-east-1:123456789:task-definition/my-td:1'

describe('listEcsServices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps ECS services to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN] })            // ListClusters
      .mockResolvedValueOnce({ serviceArns: [SERVICE_ARN] })             // ListServices
      .mockResolvedValueOnce({                                            // DescribeServices
        services: [{
          serviceArn: SERVICE_ARN,
          serviceName: 'my-svc',
          status: 'ACTIVE',
          desiredCount: 2,
          runningCount: 2,
          launchType: 'FARGATE',
          loadBalancers: [],
        }],
      })

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('ecs')
    expect(nodes[0].id).toBe(SERVICE_ARN)
    expect(nodes[0].label).toBe('my-svc')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].metadata.launchType).toBe('FARGATE')
    expect(nodes[0].metadata.desiredCount).toBe(2)
  })

  it('sets parentId from awsvpcConfiguration subnets', async () => {
    mockSend
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN] })
      .mockResolvedValueOnce({ serviceArns: [SERVICE_ARN] })
      .mockResolvedValueOnce({
        services: [{
          serviceArn: SERVICE_ARN,
          serviceName: 'my-svc',
          status: 'ACTIVE',
          loadBalancers: [],
          networkConfiguration: {
            awsvpcConfiguration: { subnets: [SUBNET_ID, 'subnet-other'] },
          },
        }],
      })

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes[0].parentId).toBe(SUBNET_ID)
  })

  it('emits ALB integration edge via target group ARN', async () => {
    mockSend
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN] })
      .mockResolvedValueOnce({ serviceArns: [SERVICE_ARN] })
      .mockResolvedValueOnce({
        services: [{
          serviceArn: SERVICE_ARN,
          serviceName: 'my-svc',
          status: 'ACTIVE',
          loadBalancers: [{ targetGroupArn: TG_ARN }],
        }],
      })

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toContainEqual({ targetId: TG_ARN, edgeType: 'origin' })
  })

  it('emits ECR integration edge from task definition container image', async () => {
    mockSend
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN] })
      .mockResolvedValueOnce({ serviceArns: [SERVICE_ARN] })
      .mockResolvedValueOnce({
        services: [{
          serviceArn: SERVICE_ARN,
          serviceName: 'my-svc',
          status: 'ACTIVE',
          loadBalancers: [],
          taskDefinition: TASK_DEF_ARN,
        }],
      })
      .mockResolvedValueOnce({                                            // DescribeTaskDefinition
        taskDefinition: {
          containerDefinitions: [{ image: ECR_IMAGE }],
        },
      })

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toContainEqual({ targetId: ECR_REPO_URI, edgeType: 'origin' })
  })

  it('paginates cluster listing across multiple pages', async () => {
    const CLUSTER_ARN_2 = 'arn:aws:ecs:us-east-1:123456789:cluster/cluster-2'
    const SERVICE_ARN_2 = 'arn:aws:ecs:us-east-1:123456789:service/cluster-2/svc-2'

    mockSend
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN], nextToken: 'tok1' }) // ListClusters page 1
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN_2] })                  // ListClusters page 2
      .mockResolvedValueOnce({ serviceArns: [SERVICE_ARN] })                    // ListServices cluster 1
      .mockResolvedValueOnce({ services: [{ serviceArn: SERVICE_ARN, serviceName: 'svc-1', status: 'ACTIVE', loadBalancers: [] }] })
      .mockResolvedValueOnce({ serviceArns: [SERVICE_ARN_2] })                  // ListServices cluster 2
      .mockResolvedValueOnce({ services: [{ serviceArn: SERVICE_ARN_2, serviceName: 'svc-2', status: 'ACTIVE', loadBalancers: [] }] })

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.label)).toEqual(['svc-1', 'svc-2'])
  })

  it('skips clusters with no services', async () => {
    mockSend
      .mockResolvedValueOnce({ clusterArns: [CLUSTER_ARN] })
      .mockResolvedValueOnce({ serviceArns: [] })                        // empty

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(0)
  })

  it('returns empty array on top-level error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Access denied'))

    const nodes = await listEcsServices(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
