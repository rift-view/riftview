import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn()
  }
}))

import { contextBridge } from 'electron'

describe('preload bridge', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.RIFTVIEW_DEMO_MODE
  })

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

  it('exposes __riftviewCapabilities with isDemoMode (amendment d)', async () => {
    await import('../../src/preload/index')
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith(
      '__riftviewCapabilities',
      expect.objectContaining({ isDemoMode: expect.any(Boolean) })
    )
  })

  it('exposes window.riftview.restore when not in demo mode', async () => {
    delete process.env.RIFTVIEW_DEMO_MODE
    await import('../../src/preload/index')
    const riftviewCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === 'riftview')
    const api = riftviewCall?.[1] as Record<string, unknown>
    expect(api).toBeDefined()
    expect(api.restore).toBeDefined()
    expect(typeof (api.restore as Record<string, unknown>).listVersions).toBe('function')
    expect(typeof (api.restore as Record<string, unknown>).planRestore).toBe('function')
    expect(typeof (api.restore as Record<string, unknown>).confirmStep).toBe('function')
    expect(typeof (api.restore as Record<string, unknown>).apply).toBe('function')
    expect(typeof (api.restore as Record<string, unknown>).cancel).toBe('function')
  })

  it('window.riftview.restore is absent in demo mode (amendment d)', async () => {
    process.env.RIFTVIEW_DEMO_MODE = '1'
    await import('../../src/preload/index')
    const riftviewCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === 'riftview')
    const api = riftviewCall?.[1] as Record<string, unknown>
    expect(api).toBeDefined()
    expect(api.restore).toBeUndefined()
    delete process.env.RIFTVIEW_DEMO_MODE
  })

  it('__riftviewCapabilities.isDemoMode reflects RIFTVIEW_DEMO_MODE env', async () => {
    process.env.RIFTVIEW_DEMO_MODE = '1'
    await import('../../src/preload/index')
    const capCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === '__riftviewCapabilities')
    const caps = capCall?.[1] as { isDemoMode: boolean }
    expect(caps.isDemoMode).toBe(true)
    delete process.env.RIFTVIEW_DEMO_MODE
  })

  it('exposes window.riftview.snapshotFile when not in demo mode (RIFT-40)', async () => {
    delete process.env.RIFTVIEW_DEMO_MODE
    await import('../../src/preload/index')
    const riftviewCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === 'riftview')
    const api = riftviewCall?.[1] as Record<string, unknown>
    expect(api).toBeDefined()
    expect(api.snapshotFile).toBeDefined()
    const snapshotFile = api.snapshotFile as Record<string, unknown>
    expect(typeof snapshotFile.exportSnapshot).toBe('function')
    expect(typeof snapshotFile.importSnapshot).toBe('function')
  })

  it('window.riftview.snapshotFile is absent in demo mode (RIFT-40)', async () => {
    process.env.RIFTVIEW_DEMO_MODE = '1'
    await import('../../src/preload/index')
    const riftviewCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === 'riftview')
    const api = riftviewCall?.[1] as Record<string, unknown>
    expect(api).toBeDefined()
    expect(api.snapshotFile).toBeUndefined()
    delete process.env.RIFTVIEW_DEMO_MODE
  })

  it('exposes window.riftview.scanFile when not in demo mode (RIFT-77)', async () => {
    delete process.env.RIFTVIEW_DEMO_MODE
    await import('../../src/preload/index')
    const riftviewCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === 'riftview')
    const api = riftviewCall?.[1] as Record<string, unknown>
    expect(api).toBeDefined()
    expect(api.scanFile).toBeDefined()
    const scanFile = api.scanFile as Record<string, unknown>
    expect(typeof scanFile.export).toBe('function')
    expect(typeof scanFile.import).toBe('function')
  })

  it('window.riftview.scanFile is absent in demo mode (RIFT-77)', async () => {
    process.env.RIFTVIEW_DEMO_MODE = '1'
    await import('../../src/preload/index')
    const riftviewCall = vi
      .mocked(contextBridge.exposeInMainWorld)
      .mock.calls.find((c) => c[0] === 'riftview')
    const api = riftviewCall?.[1] as Record<string, unknown>
    expect(api).toBeDefined()
    expect(api.scanFile).toBeUndefined()
    delete process.env.RIFTVIEW_DEMO_MODE
  })
})
