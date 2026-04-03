import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2'
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
    return Promise.all((res.LoadBalancers ?? []).map(async (lb): Promise<CloudNode> => {
      let integrations: CloudNode['integrations'] = undefined
      try {
        const tgRes = await client.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn }))
        const instanceIds: string[] = []
        for (const tg of tgRes.TargetGroups ?? []) {
          const healthRes = await client.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }))
          for (const desc of healthRes.TargetHealthDescriptions ?? []) {
            const id = desc.Target?.Id
            if (id?.startsWith('i-')) instanceIds.push(id)
          }
        }
        if (instanceIds.length > 0) {
          integrations = instanceIds.map((id) => ({ targetId: id, edgeType: 'origin' as const }))
        }
      } catch { /* ignore */ }
      return {
        id:       lb.LoadBalancerArn ?? lb.LoadBalancerName ?? 'unknown',
        type:     'alb',
        label:    lb.LoadBalancerName ?? 'ALB',
        status:   albStatusToNodeStatus(lb.State?.Code),
        region,
        metadata: { dnsName: lb.DNSName, scheme: lb.Scheme, type: lb.Type },
        parentId: lb.VpcId,
        integrations,
      }
    }))
  } catch {
    return []
  }
}
