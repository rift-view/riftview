import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useIpc } from '../../../src/renderer/hooks/useIpc'
import { useCloudStore } from '../../../src/renderer/store/cloud'

const unsubDelta  = vi.fn()
const unsubStatus = vi.fn()

beforeEach(() => {
  window.cloudblocks = {
    listProfiles:  vi.fn().mockResolvedValue([]),
    selectProfile: vi.fn().mockResolvedValue(undefined),
    selectRegion:  vi.fn().mockResolvedValue(undefined),
    startScan:     vi.fn().mockResolvedValue(undefined),
    onScanDelta:    vi.fn().mockReturnValue(unsubDelta),
    onScanStatus:   vi.fn().mockReturnValue(unsubStatus),
    onConnStatus:   vi.fn().mockReturnValue(vi.fn()),
    onScanKeypairs: vi.fn().mockReturnValue(vi.fn()),
    runCli:        vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli:     vi.fn(),
    onCliOutput:   vi.fn().mockReturnValue(vi.fn()),
    onCliDone:     vi.fn().mockReturnValue(vi.fn()),
    getSettings:   vi.fn().mockResolvedValue({ deleteConfirmStyle: 'type-to-confirm', scanInterval: 30 }),
    setSettings:   vi.fn().mockResolvedValue(undefined),
  }
  useCloudStore.setState({ nodes: [], selectedNodeId: null, scanStatus: 'idle', profile: 'default', region: 'us-east-1', view: 'topology' })
})

describe('useIpc', () => {
  it('subscribes to onScanDelta and onScanStatus on mount', () => {
    renderHook(() => useIpc())
    expect(window.cloudblocks.onScanDelta).toHaveBeenCalled()
    expect(window.cloudblocks.onScanStatus).toHaveBeenCalled()
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useIpc())
    unmount()
    expect(unsubDelta).toHaveBeenCalled()
    expect(unsubStatus).toHaveBeenCalled()
  })
})
