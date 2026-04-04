import {
  ElastiCacheClient,
  DescribeReplicationGroupsCommand,
  DescribeCacheClustersCommand,
} from '@aws-sdk/client-elasticache'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function ecStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'available')  return 'running'
  if (status === 'creating')   return 'pending'
  if (status === 'modifying')  return 'pending'
  if (status === 'deleting')   return 'pending'
  return 'unknown'
}

export async function listCacheClusters(client: ElastiCacheClient, region: string): Promise<CloudNode[]> {
  try {
    const nodes: CloudNode[] = []

    // Redis replication groups
    try {
      let marker: string | undefined
      do {
        const res = await client.send(new DescribeReplicationGroupsCommand({ Marker: marker }))
        for (const rg of res.ReplicationGroups ?? []) {
          if (!rg.ReplicationGroupId) continue
          nodes.push({
            id:     rg.ReplicationGroupId,
            type:   'elasticache',
            label:  rg.Description?.trim() || rg.ReplicationGroupId,
            status: ecStatusToNodeStatus(rg.Status),
            region,
            metadata: {
              engine:      'redis',
              nodeType:    rg.CacheNodeType,
              numCaches:   rg.MemberClusters?.length ?? 0,
              clusterMode: rg.ClusterEnabled ? 'cluster' : 'standalone',
              endpoint:    rg.NodeGroups?.[0]?.PrimaryEndpoint?.Address,
            },
          })
        }
        marker = res.Marker
      } while (marker)
    } catch { /* ignore if not available */ }

    // Memcached clusters (standalone, not part of replication group)
    try {
      let marker: string | undefined
      do {
        const res = await client.send(new DescribeCacheClustersCommand({ Marker: marker }))
        for (const cluster of res.CacheClusters ?? []) {
          if (!cluster.CacheClusterId) continue
          // Skip clusters that are part of a replication group (already covered above)
          if (cluster.ReplicationGroupId) continue
          if (cluster.Engine !== 'memcached') continue
          nodes.push({
            id:     cluster.CacheClusterId,
            type:   'elasticache',
            label:  cluster.CacheClusterId,
            status: ecStatusToNodeStatus(cluster.CacheClusterStatus),
            region,
            metadata: {
              engine:   cluster.Engine,
              nodeType: cluster.CacheNodeType,
              endpoint: cluster.CacheNodes?.[0]?.Endpoint?.Address,
            },
          })
        }
        marker = res.Marker
      } while (marker)
    } catch { /* ignore */ }

    return nodes
  } catch {
    return []
  }
}
