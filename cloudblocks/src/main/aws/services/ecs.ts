import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from '@aws-sdk/client-ecs'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function ecsStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'ACTIVE')   return 'running'
  if (status === 'DRAINING') return 'pending'
  if (status === 'INACTIVE') return 'stopped'
  return 'unknown'
}

export async function listEcsServices(client: ECSClient, region: string): Promise<CloudNode[]> {
  try {
    const nodes: CloudNode[] = []

    // List all clusters
    const clustersRes = await client.send(new ListClustersCommand({}))
    const clusterArns = clustersRes.clusterArns ?? []

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
