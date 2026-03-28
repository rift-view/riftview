import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PluginRegistry } from '../../../src/main/plugin/registry'
import type { CloudblocksPlugin } from '../../../src/main/plugin/types'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

describe('Plugin system — integration smoke test', () => {
  let registry: PluginRegistry

  const mockPlugin: CloudblocksPlugin = {
    id: 'com.test.mock',
    displayName: 'Mock Plugin',
    nodeTypes: ['mock-service'],
    nodeTypeMetadata: {
      'mock-service': {
        label: 'MOCK',
        borderColor: '#ff00ff',
        badgeColor: '#ff00ff',
        shortLabel: 'MCK',
        displayName: 'Mock Service',
        hasCreate: true,
      },
    },
    createCredentials: vi.fn().mockReturnValue({ mockCredential: true }),
    scan: vi.fn().mockResolvedValue({
      nodes: [
        {
          id: 'mock-001',
          type: 'mock-service',
          label: 'Mock Resource',
          status: 'running',
          region: 'us-east-1',
          metadata: { key: 'value' },
        },
      ],
      errors: [],
    }),
    hclGenerators: {
      'mock-service': (node) => `resource "mock_service" "${node.id}" {}`,
    },
  }

  beforeEach(() => {
    registry = new PluginRegistry()
  })

  it('mock plugin registers without touching any AWS file', () => {
    registry.register(mockPlugin)
    expect(registry.plugins).toHaveLength(1)
    expect(registry.plugins[0].id).toBe('com.test.mock')
  })

  it('scanAll returns mock plugin node', async () => {
    registry.register(mockPlugin)
    await registry.activateAll('default', ['us-east-1'])
    const result = await registry.scanAll('us-east-1')
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('mock-001')
    expect(result.nodes[0].type).toBe('mock-service')
  })

  it('getNodeTypeMetadata returns mock plugin metadata', () => {
    registry.register(mockPlugin)
    const meta = registry.getNodeTypeMetadata('mock-service')
    expect(meta?.label).toBe('MOCK')
    expect(meta?.borderColor).toBe('#ff00ff')
    expect(meta?.hasCreate).toBe(true)
  })

  it('getHclGenerator returns mock plugin generator', () => {
    registry.register(mockPlugin)
    const gen = registry.getHclGenerator('mock-service')
    expect(gen).toBeDefined()
    const hcl = gen!({ id: 'r-001', type: 'mock-service', label: 'R', status: 'running', region: 'us-east-1', metadata: {} } as unknown as import('../../../src/renderer/types/cloud').CloudNode)
    expect(hcl).toBe('resource "mock_service" "r-001" {}')
  })

  it('getAllNodeTypeMetadata includes mock plugin types', () => {
    registry.register(mockPlugin)
    const all = registry.getAllNodeTypeMetadata()
    expect(all['mock-service']?.label).toBe('MOCK')
  })

  it('duplicate NodeType registration across two plugins throws', () => {
    registry.register(mockPlugin)
    const conflicting: CloudblocksPlugin = {
      ...mockPlugin,
      id: 'com.test.conflict',
    }
    expect(() => registry.register(conflicting)).toThrow(/mock-service/)
  })
})
