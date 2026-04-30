import { describe, it, expect, vi } from 'vitest'
import { scanSshKeys } from '../../services/sshKey'
import type { HetznerClient } from '../../client'

function mockClient(keys: unknown[]): HetznerClient {
  return {
    list: vi.fn().mockResolvedValue(keys)
  }
}

describe('scanSshKeys', () => {
  it('returns 1 node for a single SSH key with no edges', async () => {
    const client = mockClient([
      {
        id: 500,
        name: 'ops-key',
        fingerprint: 'aa:bb:cc:dd',
        public_key: 'ssh-ed25519 AAAA...',
        created: '2026-01-01T00:00:00Z'
      }
    ])

    const nodes = await scanSshKeys(client, 'eu-central')

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'hcloud-ssh-key-500',
      type: 'hetzner:ssh-key',
      label: 'ops-key',
      status: 'running'
    })
    // SSH keys are project-pool, no edges — markStandalone surfaces them.
    expect(nodes[0].integrations).toBeUndefined()
    expect(nodes[0].parentId).toBeUndefined()
    expect(nodes[0].metadata.fingerprint).toBe('aa:bb:cc:dd')
  })

  it('returns multiple nodes', async () => {
    const client = mockClient([
      { id: 1, name: 'k1', fingerprint: 'a:1', public_key: 'ssh-ed25519 ABC' },
      { id: 2, name: 'k2', fingerprint: 'b:2', public_key: 'ssh-ed25519 DEF' },
      { id: 3, name: 'k3', fingerprint: 'c:3', public_key: 'ssh-ed25519 GHI' }
    ])

    const nodes = await scanSshKeys(client, 'eu-central')

    expect(nodes).toHaveLength(3)
    expect(nodes.map((n) => n.id)).toEqual([
      'hcloud-ssh-key-1',
      'hcloud-ssh-key-2',
      'hcloud-ssh-key-3'
    ])
    // None of them emit edges.
    for (const node of nodes) {
      expect(node.integrations).toBeUndefined()
    }
  })

  it('returns 0 nodes for an empty response', async () => {
    const client = mockClient([])
    const nodes = await scanSshKeys(client, 'eu-central')
    expect(nodes).toEqual([])
  })
})
