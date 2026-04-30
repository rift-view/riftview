import { describe, it, expect, vi } from 'vitest'
import { scanServers } from '../../services/server'
import type { HetznerClient } from '../../client'

function mockClient(servers: unknown[]): HetznerClient {
  return {
    list: vi.fn().mockResolvedValue(servers)
  }
}

describe('scanServers', () => {
  it('returns 1 node for a single server', async () => {
    const client = mockClient([
      {
        id: 42,
        name: 'web-1',
        status: 'running',
        datacenter: { location: { name: 'fsn1' } },
        server_type: { name: 'cx21' },
        image: { name: 'ubuntu-22.04', description: 'Ubuntu 22.04' },
        public_net: { ipv4: { ip: '203.0.113.10' } },
        private_net: [],
        volumes: []
      }
    ])

    const nodes = await scanServers(client, 'eu-central')

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'hcloud-server-42',
      type: 'hetzner:server',
      label: 'web-1',
      status: 'running',
      region: 'fsn1'
    })
    expect(nodes[0].metadata.serverType).toBe('cx21')
    expect(nodes[0].metadata.publicIp).toBe('203.0.113.10')
  })

  it('returns multiple nodes with edges for networks, volumes and firewalls', async () => {
    const client = mockClient([
      {
        id: 1,
        name: 'app-1',
        status: 'running',
        datacenter: { location: { name: 'nbg1' } },
        private_net: [{ network: 100 }, { network: 101 }],
        volumes: [200],
        public_net: {
          ipv4: { ip: '198.51.100.1' },
          firewalls: [{ id: 300 }, { id: 301 }]
        }
      },
      {
        id: 2,
        name: 'app-2',
        status: 'off',
        datacenter: { location: { name: 'nbg1' } },
        private_net: [],
        volumes: [],
        public_net: {}
      }
    ])

    const nodes = await scanServers(client, 'eu-central')

    expect(nodes).toHaveLength(2)
    expect(nodes[0].status).toBe('running')
    expect(nodes[1].status).toBe('stopped')

    const integrationTargets = nodes[0].integrations?.map((i) => i.targetId) ?? []
    expect(integrationTargets).toContain('hcloud-network-100')
    expect(integrationTargets).toContain('hcloud-network-101')
    expect(integrationTargets).toContain('hcloud-volume-200')
    expect(integrationTargets).toContain('hcloud-firewall-300')
    expect(integrationTargets).toContain('hcloud-firewall-301')
    // Per-server firewall edge: NOT subnet-routed.
    expect(nodes[0].metadata.attachedFirewalls).toEqual([
      'hcloud-firewall-300',
      'hcloud-firewall-301'
    ])
  })

  it('returns 0 nodes for an empty response', async () => {
    const client = mockClient([])
    const nodes = await scanServers(client, 'eu-central')
    expect(nodes).toEqual([])
  })

  it('maps all known status values', async () => {
    const client = mockClient([
      { id: 1, name: 'a', status: 'running', private_net: [], volumes: [] },
      { id: 2, name: 'b', status: 'off', private_net: [], volumes: [] },
      { id: 3, name: 'c', status: 'starting', private_net: [], volumes: [] },
      { id: 4, name: 'd', status: 'deleting', private_net: [], volumes: [] },
      { id: 5, name: 'e', status: 'gibberish', private_net: [], volumes: [] }
    ])

    const nodes = await scanServers(client, 'eu-central')
    expect(nodes.map((n) => n.status)).toEqual([
      'running',
      'stopped',
      'pending',
      'deleting',
      'unknown'
    ])
  })
})
