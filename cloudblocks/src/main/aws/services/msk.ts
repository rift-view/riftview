import { KafkaClient, ListClustersV2Command } from '@aws-sdk/client-kafka'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function mskStatusToNodeStatus(state: string | undefined): NodeStatus {
  if (state === 'ACTIVE')   return 'running'
  if (state === 'CREATING') return 'creating'
  if (state === 'DELETING') return 'deleting'
  if (state === 'FAILED')   return 'error'
  return 'unknown'
}

export async function listMskClusters(client: KafkaClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListClustersV2Command({}))
    return (res.ClusterInfoList ?? []).map((cluster): CloudNode => {
      const firstSubnet =
        cluster.Provisioned?.BrokerNodeGroupInfo?.ClientSubnets?.[0] ??
        cluster.Serverless?.VpcConfigs?.[0]?.SubnetIds?.[0]
      return {
        id:       cluster.ClusterArn ?? cluster.ClusterName ?? 'unknown',
        type:     'msk',
        label:    cluster.ClusterName ?? 'MSK',
        status:   mskStatusToNodeStatus(cluster.State),
        region,
        metadata: {
          clusterType:  cluster.ClusterType,
          instanceType: cluster.Provisioned?.BrokerNodeGroupInfo?.InstanceType,
        },
        ...(firstSubnet ? { parentId: firstSubnet } : {}),
      }
    })
  } catch {
    return []
  }
}
