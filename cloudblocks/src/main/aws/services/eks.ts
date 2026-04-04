import { EKSClient, ListClustersCommand, DescribeClusterCommand } from '@aws-sdk/client-eks'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function eksStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'ACTIVE')  return 'running'
  if (status === 'CREATING') return 'creating'
  if (status === 'DELETING') return 'deleting'
  if (status === 'FAILED')  return 'error'
  return 'unknown'
}

export async function listEksClusters(client: EKSClient, region: string): Promise<CloudNode[]> {
  try {
    const listRes = await client.send(new ListClustersCommand({}))
    const names = listRes.clusters ?? []
    return Promise.all(names.map(async (name): Promise<CloudNode> => {
      try {
        const descRes = await client.send(new DescribeClusterCommand({ name }))
        const cluster = descRes.cluster
        return {
          id:       cluster?.arn ?? name,
          type:     'eks',
          label:    cluster?.name ?? name,
          status:   eksStatusToNodeStatus(cluster?.status),
          region,
          metadata: {
            version:  cluster?.version,
            endpoint: cluster?.endpoint,
          },
          parentId: cluster?.resourcesVpcConfig?.vpcId,
        }
      } catch {
        return {
          id:     name,
          type:   'eks',
          label:  name,
          status: 'unknown',
          region,
          metadata: {},
        }
      }
    }))
  } catch {
    return []
  }
}
