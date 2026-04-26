import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import type { CloudNode } from '@riftview/shared'
import { useDisplayedNodes } from '../useDisplayedNodes'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

const liveNode: CloudNode = {
  id: 'live-1',
  type: 'aws:ec2',
  label: 'live',
  status: 'running',
  region: 'us-east-1',
  metadata: {}
}

const snapshotNode: CloudNode = {
  id: 'snap-1',
  type: 'aws:ec2',
  label: 'snap',
  status: 'running',
  region: 'us-east-1',
  metadata: {}
}

beforeEach(() => {
  useCloudStore.setState({ nodes: [liveNode] })
  useUIStore.setState({ canvasMode: 'live', activeSnapshotId: null, activeSnapshot: null })
})

describe('useDisplayedNodes (RIFT-38)', () => {
  it('returns live nodes when canvasMode is live', () => {
    const { result } = renderHook(() => useDisplayedNodes())
    expect(result.current).toEqual([liveNode])
  })

  it('returns live nodes in timeline mode when no snapshot is loaded', () => {
    useUIStore.setState({ canvasMode: 'timeline', activeSnapshotId: 'x', activeSnapshot: null })
    const { result } = renderHook(() => useDisplayedNodes())
    expect(result.current).toEqual([liveNode])
  })

  it('returns snapshot nodes when in timeline mode with a loaded snapshot', () => {
    useUIStore.setState({
      canvasMode: 'timeline',
      activeSnapshotId: 'ver-1',
      activeSnapshot: {
        meta: {
          id: 'ver-1',
          timestamp: '2026-04-21T00:00:00Z',
          profile: 'p',
          region: 'us-east-1',
          endpoint: null,
          contentHash: 'abc'
        },
        nodes: [snapshotNode]
      }
    })
    const { result } = renderHook(() => useDisplayedNodes())
    expect(result.current).toEqual([snapshotNode])
  })

  it('returns snapshot nodes in restore mode same as timeline mode', () => {
    useUIStore.setState({
      canvasMode: 'restore',
      activeSnapshotId: 'ver-1',
      activeSnapshot: {
        meta: {
          id: 'ver-1',
          timestamp: '2026-04-21T00:00:00Z',
          profile: 'p',
          region: 'us-east-1',
          endpoint: null,
          contentHash: 'abc'
        },
        nodes: [snapshotNode]
      }
    })
    const { result } = renderHook(() => useDisplayedNodes())
    expect(result.current).toEqual([snapshotNode])
  })
})
