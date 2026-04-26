import { describe, it, expect, vi } from 'vitest'
import { scanFirewalls } from '../../services/firewall'
import type { HetznerClient } from '../../client'

function mockClient(firewalls: unknown[]): HetznerClient {
  return {
    list: vi.fn().mockResolvedValue(firewalls)
  }
}

describe('scanFirewalls', () => {
  it('returns 1 node for a single firewall', async () => {
    const client = mockClient([
      {
        id: 300,
        name: 'web-fw',
        rules: [
          {
            direction: 'in',
            protocol: 'tcp',
            port: '80',
            source_ips: ['0.0.0.0/0']
          }
        ],
        applied_to: [{ type: 'server', server: { id: 1 } }]
      }
    ])

    const nodes = await scanFirewalls(client, 'eu-central')

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'hcloud-firewall-300',
      type: 'hetzner:firewall',
      label: 'web-fw',
      status: 'running'
    })
    expect(nodes[0].metadata.ruleCount).toBe(1)
    expect(nodes[0].metadata.appliedToServers).toEqual(['hcloud-server-1'])
  })

  it('returns multiple nodes with applied-to mappings (no edges — server scanner emits)', async () => {
    const client = mockClient([
      {
        id: 1,
        name: 'fw-a',
        rules: [],
        applied_to: [
          { type: 'server', server: { id: 10 } },
          { type: 'server', server: { id: 11 } }
        ]
      },
      {
        id: 2,
        name: 'fw-b',
        rules: [],
        applied_to: [{ type: 'label_selector', label_selector: { selector: 'env=prod' } }]
      }
    ])

    const nodes = await scanFirewalls(client, 'eu-central')

    expect(nodes).toHaveLength(2)
    expect(nodes[0].metadata.appliedToServers).toEqual(['hcloud-server-10', 'hcloud-server-11'])
    expect(nodes[1].metadata.labelSelectors).toEqual(['env=prod'])
    // Firewalls themselves do not emit integrations — server-attached edges
    // are emitted by the server scanner per RIFT-103 architecture decision.
    expect(nodes[0].integrations).toBeUndefined()
    expect(nodes[1].integrations).toBeUndefined()
  })

  it('returns 0 nodes for an empty response', async () => {
    const client = mockClient([])
    const nodes = await scanFirewalls(client, 'eu-central')
    expect(nodes).toEqual([])
  })
})
