import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useScanner } from '../../../src/renderer/hooks/useScanner'
import { useCloudStore } from '../../../src/renderer/store/cloud'

beforeEach(() => {
  window.cloudblocks = {
    listProfiles:  vi.fn().mockResolvedValue([{ name: 'default' }]),
    selectProfile: vi.fn().mockResolvedValue(undefined),
    selectRegion:  vi.fn().mockResolvedValue(undefined),
    startScan:     vi.fn().mockResolvedValue(undefined),
    onScanDelta:   vi.fn().mockReturnValue(vi.fn()),
    onScanStatus:  vi.fn().mockReturnValue(vi.fn()),
    onConnStatus:  vi.fn().mockReturnValue(vi.fn()),
    onScanKeypairs: vi.fn().mockReturnValue(vi.fn()),
    runCli:        vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli:     vi.fn(),
    onCliOutput:   vi.fn().mockReturnValue(vi.fn()),
    onCliDone:     vi.fn().mockReturnValue(vi.fn()),
    getSettings:   vi.fn().mockResolvedValue({ deleteConfirmStyle: 'type-to-confirm', scanInterval: 30 }),
    setSettings:   vi.fn().mockResolvedValue(undefined),
    getThemeOverrides: vi.fn().mockResolvedValue({}),
    createCloudFront:     vi.fn().mockResolvedValue({ code: 0 }),
    updateCloudFront:     vi.fn().mockResolvedValue({ code: 0 }),
    deleteCloudFront:     vi.fn().mockResolvedValue({ code: 0 }),
    invalidateCloudFront: vi.fn().mockResolvedValue({ code: 0 }),
    deleteAcm:            vi.fn().mockResolvedValue({ code: 0 }),
    exportTerraform:      vi.fn().mockResolvedValue({ success: true }),
    exportPng:            vi.fn().mockResolvedValue({ success: true }),
    listAwsProfiles:      vi.fn().mockResolvedValue(['default']),
    onUpdateAvailable:    vi.fn().mockReturnValue(vi.fn()),
    loadAnnotations:      vi.fn().mockResolvedValue({}),
    saveAnnotations:      vi.fn().mockResolvedValue(undefined),
  }
  useCloudStore.setState({ nodes: [], scanStatus: 'idle', profile: { name: 'default' }, region: 'us-east-1' })
})

describe('useScanner', () => {
  it('calls selectProfile with first profile on mount', async () => {
    renderHook(() => useScanner())
    await waitFor(() => expect(window.cloudblocks.selectProfile).toHaveBeenCalledWith({ name: 'default' }))
  })

  it('triggerScan calls startScan', () => {
    const { result } = renderHook(() => useScanner())
    result.current.triggerScan()
    expect(window.cloudblocks.startScan).toHaveBeenCalled()
  })
})
