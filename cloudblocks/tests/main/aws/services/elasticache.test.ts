import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ElastiCacheClient } from '@aws-sdk/client-elasticache'
import { listCacheClusters } from '../../../../src/main/aws/services/elasticache'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ElastiCacheClient

describe('listCacheClusters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Redis replication groups', () => {
    it('maps replication groups to CloudNodes', async () => {
      mockSend
        .mockResolvedValueOnce({                                           // DescribeReplicationGroups
          ReplicationGroups: [{
            ReplicationGroupId: 'my-redis',
            Description: 'My Redis Cache',
            Status: 'available',
            CacheNodeType: 'cache.r6g.large',
            ClusterEnabled: false,
            MemberClusters: ['my-redis-001', 'my-redis-002'],
            NodeGroups: [{ PrimaryEndpoint: { Address: 'my-redis.abc.ng.0001.use1.cache.amazonaws.com' } }],
          }],
        })
        .mockResolvedValueOnce({ CacheClusters: [] })                     // DescribeCacheClusters

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes).toHaveLength(1)
      expect(nodes[0].type).toBe('elasticache')
      expect(nodes[0].id).toBe('my-redis')
      expect(nodes[0].label).toBe('My Redis Cache')
      expect(nodes[0].status).toBe('running')
    })

    it('stores engine, nodeType, numCaches, clusterMode, and endpoint in metadata', async () => {
      mockSend
        .mockResolvedValueOnce({
          ReplicationGroups: [{
            ReplicationGroupId: 'my-redis',
            Description: 'redis',
            Status: 'available',
            CacheNodeType: 'cache.r6g.large',
            ClusterEnabled: true,
            MemberClusters: ['a', 'b', 'c'],
            NodeGroups: [{ PrimaryEndpoint: { Address: 'redis.primary.endpoint.com' } }],
          }],
        })
        .mockResolvedValueOnce({ CacheClusters: [] })

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes[0].metadata.engine).toBe('redis')
      expect(nodes[0].metadata.nodeType).toBe('cache.r6g.large')
      expect(nodes[0].metadata.numCaches).toBe(3)
      expect(nodes[0].metadata.clusterMode).toBe('cluster')
      expect(nodes[0].metadata.endpoint).toBe('redis.primary.endpoint.com')
    })

    it('sets clusterMode to standalone when ClusterEnabled is false', async () => {
      mockSend
        .mockResolvedValueOnce({
          ReplicationGroups: [{
            ReplicationGroupId: 'my-redis',
            Description: 'redis',
            Status: 'available',
            ClusterEnabled: false,
            MemberClusters: [],
            NodeGroups: [],
          }],
        })
        .mockResolvedValueOnce({ CacheClusters: [] })

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes[0].metadata.clusterMode).toBe('standalone')
    })

    it('uses ReplicationGroupId as label when Description is empty', async () => {
      mockSend
        .mockResolvedValueOnce({
          ReplicationGroups: [{
            ReplicationGroupId: 'my-redis',
            Description: '   ',
            Status: 'available',
            MemberClusters: [],
            NodeGroups: [],
          }],
        })
        .mockResolvedValueOnce({ CacheClusters: [] })

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes[0].label).toBe('my-redis')
    })
  })

  describe('Memcached clusters', () => {
    it('maps standalone memcached clusters to CloudNodes', async () => {
      mockSend
        .mockResolvedValueOnce({ ReplicationGroups: [] })                 // DescribeReplicationGroups
        .mockResolvedValueOnce({                                           // DescribeCacheClusters
          CacheClusters: [{
            CacheClusterId: 'my-memcached',
            CacheClusterStatus: 'available',
            Engine: 'memcached',
            CacheNodeType: 'cache.m6g.large',
            CacheNodes: [{ Endpoint: { Address: 'my-memcached.abc.cfg.use1.cache.amazonaws.com' } }],
          }],
        })

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes).toHaveLength(1)
      expect(nodes[0].type).toBe('elasticache')
      expect(nodes[0].id).toBe('my-memcached')
      expect(nodes[0].metadata.engine).toBe('memcached')
      expect(nodes[0].metadata.nodeType).toBe('cache.m6g.large')
      expect(nodes[0].metadata.endpoint).toBe('my-memcached.abc.cfg.use1.cache.amazonaws.com')
    })

    it('skips clusters that belong to a replication group', async () => {
      mockSend
        .mockResolvedValueOnce({ ReplicationGroups: [] })
        .mockResolvedValueOnce({
          CacheClusters: [{
            CacheClusterId: 'redis-001',
            CacheClusterStatus: 'available',
            Engine: 'redis',
            ReplicationGroupId: 'my-redis',             // part of RG — should be skipped
          }],
        })

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes).toHaveLength(0)
    })

    it('skips non-memcached standalone clusters', async () => {
      mockSend
        .mockResolvedValueOnce({ ReplicationGroups: [] })
        .mockResolvedValueOnce({
          CacheClusters: [{
            CacheClusterId: 'mystery-cache',
            CacheClusterStatus: 'available',
            Engine: 'valkey',                            // not memcached — should be skipped
          }],
        })

      const nodes = await listCacheClusters(mockClient, 'us-east-1')

      expect(nodes).toHaveLength(0)
    })
  })

  it('returns both redis and memcached nodes together', async () => {
    mockSend
      .mockResolvedValueOnce({
        ReplicationGroups: [{
          ReplicationGroupId: 'redis-1',
          Description: 'redis-1',
          Status: 'available',
          MemberClusters: [],
          NodeGroups: [],
        }],
      })
      .mockResolvedValueOnce({
        CacheClusters: [{
          CacheClusterId: 'memcached-1',
          CacheClusterStatus: 'available',
          Engine: 'memcached',
          CacheNodes: [],
        }],
      })

    const nodes = await listCacheClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id).sort()).toEqual(['memcached-1', 'redis-1'])
  })

  it('returns empty array on top-level error', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    const nodes = await listCacheClusters(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })

  it('continues with memcached scan if replication group fetch fails', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('RG fetch failed'))               // DescribeReplicationGroups
      .mockResolvedValueOnce({                                            // DescribeCacheClusters
        CacheClusters: [{
          CacheClusterId: 'my-memcached',
          CacheClusterStatus: 'available',
          Engine: 'memcached',
          CacheNodes: [],
        }],
      })

    const nodes = await listCacheClusters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('my-memcached')
  })
})
