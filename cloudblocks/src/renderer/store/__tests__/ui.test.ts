import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUIStore } from '../ui'

beforeEach(() => {
  useUIStore.setState({
    nodePositions:  { topology: {}, graph: {} },
    savedViews:     [null, null, null, null],
    activeViewSlot: null,
  })
})

describe('setNodePosition', () => {
  it('saves position to the correct view map', () => {
    useUIStore.getState().setNodePosition('graph', 'vpc-1', { x: 100, y: 200 })
    expect(useUIStore.getState().nodePositions.graph['vpc-1']).toEqual({ x: 100, y: 200 })
  })

  it('topology and graph maps are independent', () => {
    useUIStore.getState().setNodePosition('topology', 'vpc-1', { x: 10, y: 20 })
    expect(useUIStore.getState().nodePositions.graph['vpc-1']).toBeUndefined()
  })

  it('does not change activeViewSlot', () => {
    useUIStore.setState({ activeViewSlot: 2 })
    useUIStore.getState().setNodePosition('graph', 'vpc-1', { x: 0, y: 0 })
    expect(useUIStore.getState().activeViewSlot).toBe(2)
  })
})

describe('saveView', () => {
  it('snapshots current view positions into the slot with the given name', () => {
    useUIStore.setState({
      nodePositions: { topology: { 'vpc-1': { x: 50, y: 60 } }, graph: {} },
    })
    useUIStore.getState().saveView(1, 'Prod Layout', 'topology')
    const slot = useUIStore.getState().savedViews[1]
    expect(slot).not.toBeNull()
    expect(slot!.name).toBe('Prod Layout')
    expect(slot!.positions['vpc-1']).toEqual({ x: 50, y: 60 })
  })

  it('sets activeViewSlot to the saved slot', () => {
    useUIStore.getState().saveView(2, 'Dev', 'graph')
    expect(useUIStore.getState().activeViewSlot).toBe(2)
  })

  it('does not modify other slots', () => {
    useUIStore.getState().saveView(0, 'A', 'topology')
    useUIStore.getState().saveView(1, 'B', 'topology')
    expect(useUIStore.getState().savedViews[0]!.name).toBe('A')
    expect(useUIStore.getState().savedViews[1]!.name).toBe('B')
    expect(useUIStore.getState().savedViews[2]).toBeNull()
  })
})

describe('loadView', () => {
  it('copies slot positions into the correct view map', () => {
    useUIStore.setState({
      nodePositions: { topology: { 'vpc-1': { x: 50, y: 60 } }, graph: {} },
    })
    useUIStore.getState().saveView(0, 'Layout A', 'topology')
    useUIStore.setState({ nodePositions: { topology: {}, graph: {} } })
    const fitViewFn = vi.fn()
    useUIStore.getState().loadView(0, 'topology', fitViewFn)
    expect(useUIStore.getState().nodePositions.topology['vpc-1']).toEqual({ x: 50, y: 60 })
  })

  it('sets activeViewSlot', () => {
    useUIStore.getState().saveView(3, 'X', 'graph')
    useUIStore.getState().loadView(3, 'graph', vi.fn())
    expect(useUIStore.getState().activeViewSlot).toBe(3)
  })

  it('calls the fitView callback', () => {
    useUIStore.getState().saveView(0, 'A', 'topology')
    const fitViewFn = vi.fn()
    useUIStore.getState().loadView(0, 'topology', fitViewFn)
    expect(fitViewFn).toHaveBeenCalledOnce()
  })

  it('is a no-op when the slot is empty', () => {
    const fitViewFn = vi.fn()
    useUIStore.getState().loadView(0, 'topology', fitViewFn)
    expect(fitViewFn).not.toHaveBeenCalled()
    expect(useUIStore.getState().activeViewSlot).toBeNull()
  })
})

describe('useUIStore — annotations', () => {
  beforeEach(() => {
    useUIStore.setState({ annotations: {} })
  })

  it('setAnnotation adds a note for a nodeId', () => {
    useUIStore.getState().setAnnotation('node-1', 'my note')
    expect(useUIStore.getState().annotations['node-1']).toBe('my note')
  })

  it('setAnnotation overwrites an existing note', () => {
    useUIStore.getState().setAnnotation('node-1', 'first')
    useUIStore.getState().setAnnotation('node-1', 'second')
    expect(useUIStore.getState().annotations['node-1']).toBe('second')
  })

  it('clearAnnotation removes the note', () => {
    useUIStore.getState().setAnnotation('node-1', 'hello')
    useUIStore.getState().clearAnnotation('node-1')
    expect(useUIStore.getState().annotations['node-1']).toBeUndefined()
  })

  it('clearAnnotation on missing key does not throw', () => {
    expect(() => useUIStore.getState().clearAnnotation('nonexistent')).not.toThrow()
  })
})
