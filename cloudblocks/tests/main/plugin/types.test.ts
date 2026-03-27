import { describe, it, expect } from 'vitest'
import type { CloudblocksPlugin, NodeTypeMetadata, PluginScanResult, ScanContext } from '../../../src/main/plugin/types'

describe('CloudblocksPlugin interface — structural shape', () => {
  it('NodeTypeMetadata has all required fields', () => {
    const meta: NodeTypeMetadata = {
      label:       'EC2',
      borderColor: '#FF9900',
      badgeColor:  '#FF9900',
      shortLabel:  'EC2',
      displayName: 'EC2 Instance',
      hasCreate:   true,
    }
    expect(meta.label).toBe('EC2')
    expect(meta.hasCreate).toBe(true)
  })

  it('PluginScanResult has nodes and errors arrays', () => {
    const result: PluginScanResult = { nodes: [], errors: [] }
    expect(Array.isArray(result.nodes)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
  })

  it('ScanContext carries credentials and region', () => {
    const ctx: ScanContext = { credentials: {}, region: 'us-east-1' }
    expect(ctx.region).toBe('us-east-1')
  })

  it('CloudblocksPlugin duck-type: minimal plugin object satisfies required fields', () => {
    const plugin: CloudblocksPlugin = {
      id:              'com.test.plugin',
      displayName:     'Test Plugin',
      nodeTypes:       ['test-node'],
      nodeTypeMetadata: {
        'test-node': {
          label: 'TEST', borderColor: '#fff', badgeColor: '#fff',
          shortLabel: 'T', displayName: 'Test Node', hasCreate: false,
        },
      },
      createCredentials: (_profile, _region) => ({}),
      scan: async (_ctx) => ({ nodes: [], errors: [] }),
    }
    expect(plugin.id).toBe('com.test.plugin')
    expect(plugin.nodeTypes).toHaveLength(1)
  })
})
