import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PluginRegistry } from '../../../src/main/plugin/registry'
import type { CloudblocksPlugin } from '../../../src/main/plugin/types'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

function makePlugin(id: string, nodeTypes: string[] = ['test-node']): CloudblocksPlugin {
  return {
    id,
    displayName: `Plugin ${id}`,
    nodeTypes,
    nodeTypeMetadata: Object.fromEntries(
      nodeTypes.map((t) => [t, { label: t.toUpperCase(), borderColor: '#fff', badgeColor: '#fff', shortLabel: t, displayName: t, hasCreate: false }])
    ),
    createCredentials: vi.fn().mockReturnValue({ stubClient: true }),
    scan: vi.fn().mockResolvedValue({ nodes: [], errors: [] }),
  }
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  it('registers a plugin and exposes it in plugins[]', () => {
    const p = makePlugin('com.test.a')
    registry.register(p)
    expect(registry.plugins).toHaveLength(1)
    expect(registry.plugins[0].id).toBe('com.test.a')
  })

  it('throws on duplicate NodeType registration', () => {
    registry.register(makePlugin('com.test.a', ['shared-type']))
    expect(() => registry.register(makePlugin('com.test.b', ['shared-type']))).toThrow(/shared-type/)
  })

  it('getNodeTypeMetadata returns metadata for registered type', () => {
    registry.register(makePlugin('com.test.a', ['my-type']))
    const meta = registry.getNodeTypeMetadata('my-type')
    expect(meta?.label).toBe('MY-TYPE')
  })

  it('getNodeTypeMetadata returns undefined for unknown type', () => {
    expect(registry.getNodeTypeMetadata('not-registered')).toBeUndefined()
  })

  it('scanAll merges results from all plugins', async () => {
    const nodeA = { id: 'a', type: 'ec2' as const, label: 'A', status: 'running' as const, region: 'us-east-1', metadata: {} }
    const nodeB = { id: 'b', type: 'ec2' as const, label: 'B', status: 'running' as const, region: 'us-east-1', metadata: {} }
    const pa = makePlugin('com.test.a', ['type-a'])
    const pb = makePlugin('com.test.b', ['type-b'])
    ;(pa.scan as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [nodeA], errors: [] })
    ;(pb.scan as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [nodeB], errors: [] })

    registry.register(pa)
    registry.register(pb)
    await registry.activateAll('default', ['us-east-1'])
    const result = await registry.scanAll('us-east-1')
    expect(result.nodes).toHaveLength(2)
    expect(result.errors).toHaveLength(0)
  })

  it('scanAll isolates errors — one failing plugin does not stop others', async () => {
    const pa = makePlugin('com.test.a', ['type-a'])
    const pb = makePlugin('com.test.b', ['type-b'])
    ;(pa.scan as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
    ;(pb.scan as ReturnType<typeof vi.fn>).mockResolvedValue({ nodes: [], errors: [] })

    registry.register(pa)
    registry.register(pb)
    await registry.activateAll('default', ['us-east-1'])
    const result = await registry.scanAll('us-east-1')
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].service).toBe('com.test.a')
  })

  it('getHclGenerator returns undefined when no plugin has registered it', () => {
    registry.register(makePlugin('com.test.a', ['type-a']))
    expect(registry.getHclGenerator('type-a')).toBeUndefined()
  })

  it('getHclGenerator returns generator when plugin has registered it', () => {
    const p = makePlugin('com.test.a', ['type-a'])
    p.hclGenerators = { 'type-a': () => 'resource "mock" "r" {}' }
    registry.register(p)
    const gen = registry.getHclGenerator('type-a')
    expect(gen).toBeDefined()
  })
})
