// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('useUIStore — applyTidyLayout', () => {
  beforeEach(() => {
    useUIStore.setState({
      nodePositions: { topology: {}, graph: {} },
    })
  })

  it('replaces topology positions', () => {
    const positions = { 'n1': { x: 10, y: 20 }, 'n2': { x: 30, y: 40 } }
    useUIStore.getState().applyTidyLayout('topology', positions)
    expect(useUIStore.getState().nodePositions.topology).toEqual(positions)
  })

  it('does not affect graph positions when topology is tidied', () => {
    const graphPos = { 'g1': { x: 100, y: 200 } }
    useUIStore.setState({ nodePositions: { topology: {}, graph: graphPos } })
    useUIStore.getState().applyTidyLayout('topology', { 'n1': { x: 5, y: 5 } })
    expect(useUIStore.getState().nodePositions.graph).toEqual(graphPos)
  })

  it('does not affect topology positions when graph is tidied', () => {
    const topoPos = { 'vpc-1': { x: 40, y: 40 } }
    useUIStore.setState({ nodePositions: { topology: topoPos, graph: {} } })
    useUIStore.getState().applyTidyLayout('graph', { 'g1': { x: 10, y: 10 } })
    expect(useUIStore.getState().nodePositions.topology).toEqual(topoPos)
  })
})
