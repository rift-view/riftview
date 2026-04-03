import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { describeLoadBalancers } from '../../../../src/main/aws/services/alb'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ElasticLoadBalancingV2Client

describe('describeLoadBalancers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps ALBs to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: 'prod-alb',
          LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/prod-alb/abc',
          State: { Code: 'active' },
          VpcId: 'vpc-0abc',
        }],
      })
      .mockResolvedValueOnce({ TargetGroups: [] })
    const nodes = await describeLoadBalancers(mockClient, 'us-east-1')
    expect(nodes[0].label).toBe('prod-alb')
    expect(nodes[0].type).toBe('alb')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].parentId).toBe('vpc-0abc')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('err'))
    expect(await describeLoadBalancers(mockClient, 'us-east-1')).toEqual([])
  })

  it('populates integrations when target groups have EC2 instance targets', async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: 'prod-alb',
          LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/prod-alb/abc',
          State: { Code: 'active' },
          VpcId: 'vpc-0abc',
        }],
      })
      .mockResolvedValueOnce({
        TargetGroups: [{ TargetGroupArn: 'arn:aws:elasticloadbalancing:us-east-1:123:targetgroup/my-tg/xyz' }],
      })
      .mockResolvedValueOnce({
        TargetHealthDescriptions: [
          { Target: { Id: 'i-1234567890abcdef0' } },
          { Target: { Id: 'i-abcdef1234567890' } },
          { Target: { Id: '10.0.0.5' } }, // IP target — should be excluded
        ],
      })
    const nodes = await describeLoadBalancers(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toHaveLength(2)
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'origin')).toBe(true)
    expect(nodes[0].integrations?.map((i) => i.targetId)).toEqual([
      'i-1234567890abcdef0',
      'i-abcdef1234567890',
    ])
  })

  it('leaves integrations undefined when target group fetch fails', async () => {
    mockSend
      .mockResolvedValueOnce({
        LoadBalancers: [{
          LoadBalancerName: 'prod-alb',
          LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/prod-alb/abc',
          State: { Code: 'active' },
          VpcId: 'vpc-0abc',
        }],
      })
      .mockRejectedValueOnce(new Error('access denied'))
    const nodes = await describeLoadBalancers(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })
})
