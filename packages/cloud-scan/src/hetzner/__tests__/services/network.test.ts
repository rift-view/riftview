import { describe, it, expect, vi } from 'vitest'
import { scanNetworks } from '../../services/network'
import type { HetznerClient } from '../../client'

function mockClient(networks: unknown[]): HetznerClient {
  return {
    list: vi.fn().mockResolvedValue(networks)
  }
}

describe('scanNetworks', () => {
  it('returns 1 node for a single network', async () => {
    const client = mockClient([
      {
        id: 100,
        name: 'main-net',
        ip_range: '10.0.0.0/16',
        subnets: [{ type: 'cloud', ip_range: '10.0.1.0/24', network_zone: 'eu-central' }],
        servers: [1, 2]
      }
    ])

    const nodes = await scanNetworks(client, 'eu-central')

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'hcloud-network-100',
      type: 'hetzner:network',
      label: 'main-net',
      status: 'running',
      region: 'eu-central'
    })
    expect(nodes[0].metadata.ipRange).toBe('10.0.0.0/16')
    expect(nodes[0].metadata.attachedServers).toEqual(['hcloud-server-1', 'hcloud-server-2'])
  })

  it('returns multiple nodes with no edges (server side emits them)', async () => {
    const client = mockClient([
      { id: 100, name: 'net-a', ip_range: '10.0.0.0/16', servers: [] },
      { id: 101, name: 'net-b', ip_range: '10.1.0.0/16', servers: [5] }
    ])

    const nodes = await scanNetworks(client, 'eu-central')

    expect(nodes).toHaveLength(2)
    // Networks themselves do not emit integrations — that's the server scanner's job.
    expect(nodes[0].integrations).toBeUndefined()
    expect(nodes[1].integrations).toBeUndefined()
  })

  it('returns 0 nodes for an empty response', async () => {
    const client = mockClient([])
    const nodes = await scanNetworks(client, 'eu-central')
    expect(nodes).toEqual([])
  })
})
