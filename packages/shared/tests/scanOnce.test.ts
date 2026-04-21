import { describe, it, expect, vi } from 'vitest'
import { scanOnce } from '../src/scan/scanOnce'
import type { CloudNode } from '../src/types/cloud'

function node(
  id: string,
  integrations: { targetId: string; edgeType: 'trigger' }[] = []
): CloudNode {
  return {
    id,
    label: id,
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations
  }
}

describe('scanOnce', () => {
  it('returns nodes, errors, and durationMs from a single region scan', async () => {
    const scanAll = vi.fn(async () => ({
      nodes: [node('n1'), node('n2')],
      errors: []
    }))
    const result = await scanOnce({
      profile: 'default',
      regions: ['us-east-1'],
      scanAll
    })
    expect(scanAll).toHaveBeenCalledTimes(1)
    expect(scanAll).toHaveBeenCalledWith('us-east-1')
    expect(result.nodes.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(result.errors).toEqual([])
    expect(typeof result.durationMs).toBe('number')
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('fans out across multiple regions and merges results', async () => {
    const scanAll = vi.fn(async (region: string) => ({
      nodes: [node(`${region}-n1`)],
      errors: [{ service: 'lambda', region, message: `err in ${region}` }]
    }))
    const result = await scanOnce({
      profile: 'default',
      regions: ['us-east-1', 'us-west-2'],
      scanAll
    })
    expect(scanAll).toHaveBeenCalledTimes(2)
    expect(result.nodes.map((n) => n.id).sort()).toEqual(['us-east-1-n1', 'us-west-2-n1'])
    expect(result.errors).toHaveLength(2)
  })

  it('invokes markStandaloneNodes on the returned node set', async () => {
    const scanAll = vi.fn(async () => ({
      nodes: [
        node('isolated'),
        node('source', [{ targetId: 'target', edgeType: 'trigger' }]),
        node('target')
      ],
      errors: []
    }))
    const result = await scanOnce({ profile: 'default', regions: ['us-east-1'], scanAll })
    const isolated = result.nodes.find((n) => n.id === 'isolated')
    const source = result.nodes.find((n) => n.id === 'source')
    expect(isolated?.metadata.standalone).toBe(true)
    expect(source?.metadata.standalone).toBe(false)
  })

  it('calls the optional activate hook before scanning', async () => {
    const activate = vi.fn(async () => undefined)
    const scanAll = vi.fn(async () => ({ nodes: [], errors: [] }))
    await scanOnce({
      profile: 'myprofile',
      regions: ['us-east-1'],
      endpoint: 'http://localhost:4566',
      activate,
      scanAll
    })
    expect(activate).toHaveBeenCalledOnce()
    expect(activate).toHaveBeenCalledWith('myprofile', ['us-east-1'], 'http://localhost:4566')
  })
})
