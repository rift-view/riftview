import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useUIStore, type CanvasMode } from '../../../src/renderer/store/ui'

describe('useUIStore — canvasMode (RIF-19)', () => {
  beforeEach(() => {
    useUIStore.getState().setCanvasMode('live')
  })
  afterEach(() => {
    useUIStore.getState().setCanvasMode('live')
  })

  it('defaults to live with no active snapshot', () => {
    const { canvasMode, activeSnapshotId } = useUIStore.getState()
    expect(canvasMode).toBe<CanvasMode>('live')
    expect(activeSnapshotId).toBeNull()
  })

  it('setCanvasMode("timeline", id) pins the snapshot', () => {
    useUIStore.getState().setCanvasMode('timeline', '01ARZ3NDEKTSV4RRFFQ69G5FAV')
    const { canvasMode, activeSnapshotId } = useUIStore.getState()
    expect(canvasMode).toBe('timeline')
    expect(activeSnapshotId).toBe('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  })

  it('setCanvasMode("restore", id) pins the snapshot', () => {
    useUIStore.getState().setCanvasMode('restore', 'snap-xyz')
    const { canvasMode, activeSnapshotId } = useUIStore.getState()
    expect(canvasMode).toBe('restore')
    expect(activeSnapshotId).toBe('snap-xyz')
  })

  it('setCanvasMode("live") clears any pinned snapshot', () => {
    useUIStore.getState().setCanvasMode('timeline', 'snap-a')
    expect(useUIStore.getState().activeSnapshotId).toBe('snap-a')

    useUIStore.getState().setCanvasMode('live')
    expect(useUIStore.getState().canvasMode).toBe('live')
    expect(useUIStore.getState().activeSnapshotId).toBeNull()
  })

  it('setCanvasMode("timeline") without a snapshot id leaves activeSnapshotId null', () => {
    useUIStore.getState().setCanvasMode('timeline')
    expect(useUIStore.getState().canvasMode).toBe('timeline')
    expect(useUIStore.getState().activeSnapshotId).toBeNull()
  })

  it('transitions timeline → restore preserve the pinned snapshot when provided', () => {
    useUIStore.getState().setCanvasMode('timeline', 'snap-1')
    useUIStore.getState().setCanvasMode('restore', 'snap-1')
    expect(useUIStore.getState().canvasMode).toBe('restore')
    expect(useUIStore.getState().activeSnapshotId).toBe('snap-1')
  })
})
