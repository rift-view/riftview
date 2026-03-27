import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { NodeTypeMetadata } from '../../../src/renderer/types/plugin'

describe('useUIStore — pluginNodeTypes', () => {
  beforeEach(() => {
    useUIStore.setState({ pluginNodeTypes: {} })
  })

  it('pluginNodeTypes defaults to empty object', () => {
    expect(useUIStore.getState().pluginNodeTypes).toEqual({})
  })

  it('setPluginNodeTypes stores metadata keyed by type string', () => {
    const meta: NodeTypeMetadata = {
      label: 'AKS', borderColor: '#0078D4', badgeColor: '#0078D4',
      shortLabel: 'AKS', displayName: 'Azure Kubernetes Service', hasCreate: true,
    }
    useUIStore.getState().setPluginNodeTypes({ 'azure-aks': meta })
    expect(useUIStore.getState().pluginNodeTypes['azure-aks']?.label).toBe('AKS')
  })

  it('setPluginNodeTypes overwrites previous metadata', () => {
    useUIStore.getState().setPluginNodeTypes({ 'type-a': { label: 'A', borderColor: '#000', badgeColor: '#000', shortLabel: 'A', displayName: 'A', hasCreate: false } })
    useUIStore.getState().setPluginNodeTypes({ 'type-b': { label: 'B', borderColor: '#111', badgeColor: '#111', shortLabel: 'B', displayName: 'B', hasCreate: false } })
    expect(useUIStore.getState().pluginNodeTypes['type-a']).toBeUndefined()
    expect(useUIStore.getState().pluginNodeTypes['type-b']?.label).toBe('B')
  })
})
