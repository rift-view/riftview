import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useScanner } from '../../../src/renderer/hooks/useScanner'
import { useCloudStore } from '../../../src/renderer/store/cloud'

beforeEach(() => {
  window.terminus = {
    listProfiles: vi.fn().mockResolvedValue([{ name: 'default' }]),
    selectProfile: vi.fn().mockResolvedValue(undefined),
    selectRegion: vi.fn().mockResolvedValue(undefined),
    startScan: vi.fn().mockResolvedValue(undefined),
    onScanDelta: vi.fn().mockReturnValue(vi.fn()),
    onScanStatus: vi.fn().mockReturnValue(vi.fn()),
    onConnStatus: vi.fn().mockReturnValue(vi.fn()),
    onScanErrorDetail: vi.fn().mockReturnValue(vi.fn()),
    onScanKeypairs: vi.fn().mockReturnValue(vi.fn()),
    runCli: vi.fn().mockResolvedValue({ code: 0 }),
    cancelCli: vi.fn(),
    onCliOutput: vi.fn().mockReturnValue(vi.fn()),
    onCliDone: vi.fn().mockReturnValue(vi.fn()),
    getSettings: vi
      .fn()
      .mockResolvedValue({ deleteConfirmStyle: 'type-to-confirm', scanInterval: 30 }),
    setSettings: vi.fn().mockResolvedValue(undefined),
    getThemeOverrides: vi.fn().mockResolvedValue({}),
    createCloudFront: vi.fn().mockResolvedValue({ code: 0 }),
    updateCloudFront: vi.fn().mockResolvedValue({ code: 0 }),
    deleteCloudFront: vi.fn().mockResolvedValue({ code: 0 }),
    invalidateCloudFront: vi.fn().mockResolvedValue({ code: 0 }),
    deleteAcm: vi.fn().mockResolvedValue({ code: 0 }),
    exportTerraform: vi.fn().mockResolvedValue({ success: true }),
    exportPng: vi.fn().mockResolvedValue({ success: true }),
    listAwsProfiles: vi.fn().mockResolvedValue(['default']),
    onUpdateAvailable: vi.fn().mockReturnValue(vi.fn()),
    loadAnnotations: vi.fn().mockResolvedValue({}),
    saveAnnotations: vi.fn().mockResolvedValue(undefined),
    importTfState: vi.fn().mockResolvedValue({ nodes: [] }),
    clearTfState: vi.fn().mockResolvedValue({ ok: true }),
    analyzeIam: vi.fn().mockResolvedValue({ nodeId: '', findings: [], fetchedAt: 0 }),
    notifyDrift: vi.fn().mockResolvedValue(undefined),
    onPluginMetadata: vi.fn().mockReturnValue(vi.fn()),
    terraformDeploy: vi.fn().mockResolvedValue({ status: 'not_found' }),
    loadCustomEdges: vi.fn().mockResolvedValue([]),
    saveCustomEdges: vi.fn().mockResolvedValue(undefined),
    listTfStateModules: vi.fn().mockResolvedValue({ modules: [] }),
    saveBaseline: vi.fn().mockResolvedValue({ ok: true }),
    retryScanService: vi.fn().mockResolvedValue({ ok: true }),
    saveExportImage: vi.fn().mockResolvedValue({ success: true }),
    validateCredentials: vi.fn().mockResolvedValue({
      ok: true,
      account: '123456789012',
      arn: 'arn:aws:iam::123456789012:user/test'
    }),
    fetchMetrics: vi.fn().mockResolvedValue([]),
    getNodeHistory: vi.fn().mockResolvedValue([]),
    startTerminal: vi.fn().mockResolvedValue({ ok: true, sessionId: 'test-session' }),
    sendTerminalInput: vi.fn().mockResolvedValue(undefined),
    resizeTerminal: vi.fn().mockResolvedValue(undefined),
    closeTerminal: vi.fn().mockResolvedValue(undefined),
    onTerminalOutput: vi.fn().mockReturnValue(vi.fn())
  }
  useCloudStore.setState({
    nodes: [],
    scanStatus: 'idle',
    profile: { name: 'default' },
    region: 'us-east-1'
  })
})

describe('useScanner', () => {
  it('calls selectProfile with first profile on mount', async () => {
    renderHook(() => useScanner())
    await waitFor(() =>
      expect(window.terminus.selectProfile).toHaveBeenCalledWith({ name: 'default' })
    )
  })

  it('triggerScan calls startScan', async () => {
    const { result } = renderHook(() => useScanner())
    await result.current.triggerScan()
    expect(window.terminus.startScan).toHaveBeenCalled()
  })

  it('aborts scan and shows toast when credentials are invalid', async () => {
    window.terminus.validateCredentials = vi.fn().mockResolvedValue({
      ok: false,
      error: 'ExpiredTokenException: The security token included in the request is expired'
    })
    window.terminus.startScan = vi.fn().mockResolvedValue(undefined)

    const showToastSpy = vi.fn()
    const { useUIStore } = await import('../../../src/renderer/store/ui')
    const origGetState = useUIStore.getState
    vi.spyOn(useUIStore, 'getState').mockReturnValue({
      ...origGetState(),
      showToast: showToastSpy
    })

    const { result } = renderHook(() => useScanner())
    await result.current.triggerScan()

    expect(window.terminus.startScan).not.toHaveBeenCalled()
    expect(showToastSpy).toHaveBeenCalledWith(expect.stringContaining('Credential error'), 'error')

    vi.restoreAllMocks()
  })
})
