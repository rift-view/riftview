import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
} from '@aws-sdk/client-ecs'
import type { CloudNode, NodeStatus, EdgeType } from '../../../renderer/types/cloud'

function ecsStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'ACTIVE')   return 'running'
  if (status === 'DRAINING') return 'pending'
  if (status === 'INACTIVE') return 'stopped'
  return 'unknown'
}

export async function listEcsServices(client: ECSClient, region: string): Promise<CloudNode[]> {
  try {
    const nodes: CloudNode[] = []

    // List all clusters (paginated)
    const clusterArns: string[] = []
    let clusterToken: string | undefined
    do {
      const clustersRes = await client.send(new ListClustersCommand({ nextToken: clusterToken }))
      clusterArns.push(...(clustersRes.clusterArns ?? []))
      clusterToken = clustersRes.nextToken
    } while (clusterToken)

    for (const clusterArn of clusterArns) {
      try {
        // List services in cluster (paginated)
        const serviceArns: string[] = []
        let nextToken: string | undefined
        do {
          const res = await client.send(new ListServicesCommand({ cluster: clusterArn, nextToken }))
          serviceArns.push(...(res.serviceArns ?? []))
          nextToken = res.nextToken
        } while (nextToken)

        if (serviceArns.length === 0) continue

        // Describe services in batches of 10 (API limit)
        for (let i = 0; i < serviceArns.length; i += 10) {
          const batch = serviceArns.slice(i, i + 10)
          const descRes = await client.send(new DescribeServicesCommand({ cluster: clusterArn, services: batch }))
          for (const svc of descRes.services ?? []) {
            if (!svc.serviceArn) continue

            const integrations: { targetId: string; edgeType: EdgeType }[] = []
            // ALB associations via target group ARNs
            for (const lb of svc.loadBalancers ?? []) {
              if (lb.targetGroupArn) integrations.push({ targetId: lb.targetGroupArn, edgeType: 'origin' })
            }
            if (svc.taskDefinition) {
              try {
                const tdRes = await client.send(new DescribeTaskDefinitionCommand({ taskDefinition: svc.taskDefinition }))
                for (const container of tdRes.taskDefinition?.containerDefinitions ?? []) {
                  const image = container.image
                  // ECR images: account.dkr.ecr.region.amazonaws.com/repo:tag
                  if (image?.includes('.dkr.ecr.')) {
                    // Strip tag/digest to get repo URI (ECR node ID)
                    const repoUri = image.replace(/[:@][^/]*$/, '')
                    integrations.push({ targetId: repoUri, edgeType: 'origin' })
                  }
                }
              } catch { /* ignore */ }
            }

            const firstSubnet = svc.networkConfiguration?.awsvpcConfiguration?.subnets?.[0]
            nodes.push({
              id:     svc.serviceArn,
              type:   'ecs',
              label:  svc.serviceName ?? svc.serviceArn,
              status: ecsStatusToNodeStatus(svc.status),
              region,
              metadata: {
                clusterArn:   clusterArn,
                clusterName:  clusterArn.split('/').pop() ?? clusterArn,
                desiredCount: svc.desiredCount,
                runningCount: svc.runningCount,
                launchType:   svc.launchType,
              },
              ...(firstSubnet ? { parentId: firstSubnet } : {}),
              ...(integrations.length > 0 ? { integrations } : {}),
            })
          }
        }
      } catch { /* skip failed cluster */ }
    }

    return nodes
  } catch {
    return []
  }
}
