import { describe, it, expect, vi } from 'vitest'
import { scanVolumes } from '../../services/volume'
import type { HetznerClient } from '../../client'

function mockClient(volumes: unknown[]): HetznerClient {
  return {
    list: vi.fn().mockResolvedValue(volumes)
  }
}

describe('scanVolumes', () => {
  it('returns 1 node for a single volume', async () => {
    const client = mockClient([
      {
        id: 200,
        name: 'data-vol',
        status: 'available',
        size: 50,
        server: 1,
        location: { name: 'fsn1' },
        format: 'ext4',
        protection: { delete: false }
      }
    ])

    const nodes = await scanVolumes(client, 'eu-central')

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'hcloud-volume-200',
      type: 'hetzner:volume',
      label: 'data-vol',
      status: 'running',
      region: 'fsn1'
    })
    expect(nodes[0].metadata.sizeGb).toBe(50)
    expect(nodes[0].metadata.attachedServer).toBe('hcloud-server-1')
  })

  it('returns multiple nodes including unattached volume', async () => {
    const client = mockClient([
      { id: 1, name: 'vol-a', status: 'available', size: 10, server: 5 },
      { id: 2, name: 'vol-b', status: 'available', size: 20, server: null },
      { id: 3, name: 'vol-c', status: 'creating', size: 30, server: null }
    ])

    const nodes = await scanVolumes(client, 'eu-central')

    expect(nodes).toHaveLength(3)
    expect(nodes[0].metadata.attachedServer).toBe('hcloud-server-5')
    expect(nodes[1].metadata.attachedServer).toBeNull()
    expect(nodes[2].status).toBe('creating')
  })

  it('returns 0 nodes for an empty response', async () => {
    const client = mockClient([])
    const nodes = await scanVolumes(client, 'eu-central')
    expect(nodes).toEqual([])
  })
})
