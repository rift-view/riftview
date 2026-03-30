import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { CustomEdge } from '../../../src/renderer/types/cloud'

const EDGE: CustomEdge = { id: 'e1', source: 'a', target: 'b', color: '#22c55e' }

describe('useUIStore — customEdges', () => {
  beforeEach(() => {
    useUIStore.setState({ customEdges: [] })
  })

  it('adds a custom edge', () => {
    useUIStore.getState().addCustomEdge(EDGE)
    expect(useUIStore.getState().customEdges).toHaveLength(1)
    expect(useUIStore.getState().customEdges[0].id).toBe('e1')
  })

  it('removes a custom edge by id', () => {
    useUIStore.getState().addCustomEdge(EDGE)
    useUIStore.getState().removeCustomEdge('e1')
    expect(useUIStore.getState().customEdges).toHaveLength(0)
  })

  it('updates a custom edge label', () => {
    useUIStore.getState().addCustomEdge(EDGE)
    useUIStore.getState().updateCustomEdgeLabel('e1', 'hello')
    expect(useUIStore.getState().customEdges[0].label).toBe('hello')
  })

  it('updates a custom edge color', () => {
    useUIStore.getState().addCustomEdge(EDGE)
    useUIStore.getState().updateCustomEdgeColor('e1', '#ef4444')
    expect(useUIStore.getState().customEdges[0].color).toBe('#ef4444')
  })

  it('sets all custom edges at once', () => {
    const edges: CustomEdge[] = [
      EDGE,
      { id: 'e2', source: 'b', target: 'c', color: '#6366f1', label: 'lb' },
    ]
    useUIStore.getState().setCustomEdges(edges)
    expect(useUIStore.getState().customEdges).toHaveLength(2)
    expect(useUIStore.getState().customEdges[1].label).toBe('lb')
  })

  it('does not affect other state when adding an edge', () => {
    const before = useUIStore.getState().showIntegrations
    useUIStore.getState().addCustomEdge(EDGE)
    expect(useUIStore.getState().showIntegrations).toBe(before)
  })
})
