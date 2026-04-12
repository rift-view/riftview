import { KafkaClient, ListClustersV2Command } from '@aws-sdk/client-kafka'
import { LambdaClient, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, NodeStatus, EdgeType } from '../../../renderer/types/cloud'

function mskStatusToNodeStatus(state: string | undefined): NodeStatus {
  if (state === 'ACTIVE')   return 'running'
  if (state === 'CREATING') return 'creating'
  if (state === 'DELETING') return 'deleting'
  if (state === 'FAILED')   return 'error'
  return 'unknown'
}

export async function listMskClusters(client: KafkaClient, lambdaClient: LambdaClient, region: string): Promise<CloudNode[]> {
  try {
    const allClusters: import('@aws-sdk/client-kafka').Cluster[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new ListClustersV2Command({ NextToken: nextToken }))
      allClusters.push(...(res.ClusterInfoList ?? []))
      nextToken = res.NextToken
    } while (nextToken)

    return Promise.all(
      allClusters.map(async (cluster): Promise<CloudNode> => {
        const firstSubnet =
          cluster.Provisioned?.BrokerNodeGroupInfo?.ClientSubnets?.[0] ??
          cluster.Serverless?.VpcConfigs?.[0]?.SubnetIds?.[0]
        const clusterArn = cluster.ClusterArn ?? cluster.ClusterName ?? 'unknown'
        const baseNode: CloudNode = {
          id:       clusterArn,
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

        if (!cluster.ClusterArn) return baseNode

        const mappingRes = await lambdaClient
          .send(new ListEventSourceMappingsCommand({ EventSourceArn: cluster.ClusterArn }))
          .catch(() => ({ EventSourceMappings: [] }))

        const integrations: { targetId: string; edgeType: EdgeType }[] = (
          mappingRes.EventSourceMappings ?? []
        )
          .filter((m): m is typeof m & { FunctionArn: string } => m.FunctionArn != null)
          .map((m) => ({ targetId: m.FunctionArn, edgeType: 'trigger' as EdgeType }))

        return integrations.length > 0 ? { ...baseNode, integrations } : baseNode
      })
    )
  } catch {
    return []
  }
}
