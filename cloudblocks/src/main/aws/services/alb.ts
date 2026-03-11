import { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand } from '@aws-sdk/client-elastic-load-balancing-v2'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function albStatusToNodeStatus(code: string | undefined): NodeStatus {
  if (code === 'active')       return 'running'
  if (code === 'provisioning') return 'pending'
  if (code === 'failed')       return 'error'
  return 'unknown'
}

export async function describeLoadBalancers(
  client: ElasticLoadBalancingV2Client,
  region: string,
): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeLoadBalancersCommand({}))
    return (res.LoadBalancers ?? []).map((lb): CloudNode => ({
      id:       lb.LoadBalancerArn ?? lb.LoadBalancerName ?? 'unknown',
      type:     'alb',
      label:    lb.LoadBalancerName ?? 'ALB',
      status:   albStatusToNodeStatus(lb.State?.Code),
      region,
      metadata: { dnsName: lb.DNSName, scheme: lb.Scheme, type: lb.Type },
      parentId: lb.VpcId,
    }))
  } catch {
    return []
  }
}
