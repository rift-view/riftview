import { describe, it, expect, vi } from 'vitest'
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { describeLoadBalancers } from '../../../../src/main/aws/services/alb'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ElasticLoadBalancingV2Client

describe('describeLoadBalancers', () => {
  it('maps ALBs to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      LoadBalancers: [{
        LoadBalancerName: 'prod-alb',
        LoadBalancerArn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/prod-alb/abc',
        State: { Code: 'active' },
        VpcId: 'vpc-0abc',
      }],
    })
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
})
