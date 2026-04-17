/**
 * Blast radius state contract tests.
 *
 * All three canvas views (CommandView, TopologyView, GraphView) share the
 * same UIStore blast-radius state. These tests cover the store invariants
 * that every view depends on.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('UIStore blast radius contract', () => {
  beforeEach(() => {
    useUIStore.setState({ blastRadiusId: null, pathTraceId: null, savedViewport: null })
  })

  it('setBlastRadiusId clears pathTraceId (they are mutually exclusive)', () => {
    useUIStore.setState({ pathTraceId: 'node-1' })
    useUIStore.getState().setBlastRadiusId('node-2')
    expect(useUIStore.getState().blastRadiusId).toBe('node-2')
    expect(useUIStore.getState().pathTraceId).toBeNull()
  })

  it('setPathTraceId clears blastRadiusId', () => {
    useUIStore.setState({ blastRadiusId: 'node-1' })
    useUIStore.getState().setPathTraceId('node-2')
    expect(useUIStore.getState().pathTraceId).toBe('node-2')
    expect(useUIStore.getState().blastRadiusId).toBeNull()
  })

  it('setSavedViewport stores the viewport tuple', () => {
    useUIStore.getState().setSavedViewport({ x: 100, y: 200, zoom: 0.75 })
    expect(useUIStore.getState().savedViewport).toEqual({ x: 100, y: 200, zoom: 0.75 })
  })

  it('setSavedViewport(null) clears saved viewport', () => {
    useUIStore.setState({ savedViewport: { x: 1, y: 2, zoom: 1 } })
    useUIStore.getState().setSavedViewport(null)
    expect(useUIStore.getState().savedViewport).toBeNull()
  })

  it('clearing blastRadiusId does not touch savedViewport (views restore on exit)', () => {
    useUIStore.setState({ blastRadiusId: 'n', savedViewport: { x: 5, y: 5, zoom: 1 } })
    useUIStore.getState().setBlastRadiusId(null)
    // savedViewport stays — canvas views consume it, restore, then clear
    expect(useUIStore.getState().savedViewport).toEqual({ x: 5, y: 5, zoom: 1 })
  })
})
