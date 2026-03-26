import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('useUIStore — selectedNodeIds', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedNodeIds: new Set<string>() })
  })

  it('starts with an empty set', () => {
    expect(useUIStore.getState().selectedNodeIds.size).toBe(0)
  })

  it('setSelectedNodeIds stores the provided set', () => {
    const ids = new Set(['i-001', 'i-002', 'i-003'])
    useUIStore.getState().setSelectedNodeIds(ids)
    const stored = useUIStore.getState().selectedNodeIds
    expect(stored.size).toBe(3)
    expect(stored.has('i-001')).toBe(true)
    expect(stored.has('i-002')).toBe(true)
    expect(stored.has('i-003')).toBe(true)
  })

  it('clearSelectedNodeIds empties the set', () => {
    useUIStore.getState().setSelectedNodeIds(new Set(['i-001', 'i-002']))
    useUIStore.getState().clearSelectedNodeIds()
    expect(useUIStore.getState().selectedNodeIds.size).toBe(0)
  })

  it('setSelectedNodeIds replaces the previous set', () => {
    useUIStore.getState().setSelectedNodeIds(new Set(['i-001', 'i-002']))
    useUIStore.getState().setSelectedNodeIds(new Set(['i-003']))
    const stored = useUIStore.getState().selectedNodeIds
    expect(stored.size).toBe(1)
    expect(stored.has('i-003')).toBe(true)
    expect(stored.has('i-001')).toBe(false)
  })

  it('selectedNodeId remains independent of selectedNodeIds', () => {
    useUIStore.getState().selectNode('i-001')
    useUIStore.getState().setSelectedNodeIds(new Set(['i-002', 'i-003']))
    // selectedNodeId unchanged
    expect(useUIStore.getState().selectedNodeId).toBe('i-001')
    // selectedNodeIds updated independently
    expect(useUIStore.getState().selectedNodeIds.size).toBe(2)
  })
})
