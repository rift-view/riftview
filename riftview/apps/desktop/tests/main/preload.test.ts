import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn()
  }
}))

import { contextBridge } from 'electron'

describe('preload bridge', () => {
  it('exposes riftview API to main world', async () => {
    await import('../../src/preload/index')
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      'riftview',
      expect.objectContaining({
        listProfiles: expect.any(Function),
        selectProfile: expect.any(Function),
        selectRegion: expect.any(Function),
        startScan: expect.any(Function),
        onScanDelta: expect.any(Function),
        onScanStatus: expect.any(Function),
        onConnStatus: expect.any(Function)
      })
    )
  })
})
