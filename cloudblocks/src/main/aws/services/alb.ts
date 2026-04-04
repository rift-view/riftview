import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
  DescribeListenersCommand,
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
      const allIntegrations: { targetId: string; edgeType: 'origin' | 'trigger' }[] = []
      try {
        const tgRes = await client.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn }))
        for (const tg of tgRes.TargetGroups ?? []) {
          const healthRes = await client.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }))
          for (const desc of healthRes.TargetHealthDescriptions ?? []) {
            const id = desc.Target?.Id
            if (id?.startsWith('i-')) allIntegrations.push({ targetId: id, edgeType: 'origin' })
            if (id?.startsWith('arn:aws:lambda:')) allIntegrations.push({ targetId: id, edgeType: 'trigger' })
          }
        }
      } catch { /* ignore */ }
      try {
        // ACM certificates used by HTTPS listeners
        const listenersRes = await client.send(new DescribeListenersCommand({ LoadBalancerArn: lb.LoadBalancerArn }))
        const certArns = [...new Set(
          (listenersRes.Listeners ?? [])
            .flatMap((l) => l.Certificates ?? [])
            .map((c) => c.CertificateArn)
            .filter((arn): arn is string => !!arn && arn.includes(':certificate/')),
        )]
        for (const arn of certArns) {
          allIntegrations.push({ targetId: arn, edgeType: 'origin' })
        }
      } catch { /* ignore */ }
      const integrations = allIntegrations.length > 0 ? allIntegrations : undefined
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
