import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../../src/renderer/store/ui'

// Note: Tests 2 and 3 test the store directly rather than TopologyView internals,
// because TopologyView depends on ReactFlow context (useReactFlow) which cannot be
// trivially rendered in a unit test without a full ReactFlowProvider setup.

describe('useUIStore — zoneSizes', () => {
  beforeEach(() => {
    useUIStore.setState({ zoneSizes: {} })
  })

  it('setZoneSize stores the size keyed by zone id', () => {
    useUIStore.getState().setZoneSize('region-zone-us-east-1', { width: 500, height: 300 })
    const size = useUIStore.getState().zoneSizes['region-zone-us-east-1']
    expect(size).toEqual({ width: 500, height: 300 })
  })

  it('setZoneSize can store multiple zones independently', () => {
    useUIStore.getState().setZoneSize('region-zone-us-east-1', { width: 400, height: 200 })
    useUIStore.getState().setZoneSize('region-zone-eu-west-1', { width: 600, height: 350 })
    const sizes = useUIStore.getState().zoneSizes
    expect(sizes['region-zone-us-east-1']).toEqual({ width: 400, height: 200 })
    expect(sizes['region-zone-eu-west-1']).toEqual({ width: 600, height: 350 })
  })

  it('setZoneSize updates an existing zone size', () => {
    useUIStore.getState().setZoneSize('region-zone-us-east-1', { width: 400, height: 200 })
    useUIStore.getState().setZoneSize('region-zone-us-east-1', { width: 800, height: 400 })
    const size = useUIStore.getState().zoneSizes['region-zone-us-east-1']
    expect(size).toEqual({ width: 800, height: 400 })
  })

  it('starts with an empty zoneSizes record', () => {
    expect(useUIStore.getState().zoneSizes).toEqual({})
  })

  it('setZoneSize does not affect other zone sizes', () => {
    useUIStore.getState().setZoneSize('region-zone-us-east-1', { width: 400, height: 200 })
    useUIStore.getState().setZoneSize('region-zone-eu-west-1', { width: 600, height: 350 })
    // Update only us-east-1
    useUIStore.getState().setZoneSize('region-zone-us-east-1', { width: 450, height: 250 })
    // eu-west-1 should be unchanged
    expect(useUIStore.getState().zoneSizes['region-zone-eu-west-1']).toEqual({ width: 600, height: 350 })
    expect(useUIStore.getState().zoneSizes['region-zone-us-east-1']).toEqual({ width: 450, height: 250 })
  })
})
