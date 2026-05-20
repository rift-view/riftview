// @vitest-environment node
/**
 * RIFT-125: Snapshot IPC handlers must be gated behind isDemoMode().
 *
 * In demo mode (RIFTVIEW_DEMO_MODE=1), snapshot:list → [], snapshot:read → null,
 * snapshot:delete → { ok: false }. The store functions must not be called.
 *
 * In normal mode the handlers delegate to the store functions as usual.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---- Electron mock (ipcMain.handle) ----------------------------------------
// We capture handler functions so we can invoke them directly in tests.
const handlers: Record<string, (...args: unknown[]) => unknown> = {}
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => {
      handlers[channel] = fn
    },
    on: vi.fn(),
    removeAllListeners: vi.fn()
  },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
  app: { getPath: vi.fn(() => '/tmp'), isPackaged: false, getName: vi.fn() },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  Notification: vi.fn().mockImplementation(() => ({ show: vi.fn() })),
  safeStorage: { isEncryptionAvailable: vi.fn(() => false) }
}))

// ---- Store mocks -------------------------------------------------------------
// vi.hoisted() ensures these variables are evaluated before vi.mock() factories
// run (which are hoisted to the top of the file by vitest's transform).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any
const { mockListVersionsSafe, mockReadSnapshotSafe, mockDeleteSnapshotSafe } = vi.hoisted(() => ({
  mockListVersionsSafe: vi.fn<AnyFn>(),
  mockReadSnapshotSafe: vi.fn<AnyFn>(),
  mockDeleteSnapshotSafe: vi.fn<AnyFn>()
}))

vi.mock('../../history/index', () => ({
  listVersionsSafe: (...args: unknown[]) => mockListVersionsSafe(...args),
  readSnapshotSafe: (...args: unknown[]) => mockReadSnapshotSafe(...args),
  deleteSnapshotSafe: (...args: unknown[]) => mockDeleteSnapshotSafe(...args),
  writeSnapshotSafe: vi.fn(() => null),
  initSnapshotStore: vi.fn(),
  closeSnapshotStore: vi.fn(),
  isSnapshotStoreOpen: vi.fn(() => false),
  SnapshotFileError: class SnapshotFileError extends Error {},
  parseSnapshotFile: vi.fn(),
  serializeSnapshotFile: vi.fn(),
  snapshotFileIdentity: vi.fn(),
  snapshotToFile: vi.fn()
}))

// ---- Other heavy deps -------------------------------------------------------
vi.mock('@riftview/shared', () => ({
  listProfiles: vi.fn(() => []),
  getDefaultRegion: vi.fn(() => 'us-east-1')
}))

vi.mock('@riftview/cloud-scan', () => ({
  createClients: vi.fn(),
  pluginRegistry: { scan: vi.fn() },
  cfCreateDistribution: vi.fn(),
  cfUpdateDistribution: vi.fn(),
  cfDeleteDistribution: vi.fn(),
  cfCreateInvalidation: vi.fn(),
  fetchMetricsForProfile: vi.fn(),
  validateAwsCredentials: vi.fn()
}))

vi.mock('../../aws/scanner', () => ({
  ResourceScanner: vi.fn(),
  historyFilePath: vi.fn(() => '/tmp/history.json')
}))

vi.mock('../../terraform/index', () => ({ generateTerraformFile: vi.fn() }))
vi.mock('../../terraform/provider', () => ({ buildLocalStackProvider: vi.fn() }))
vi.mock('../../restore/hmac', () => ({
  signPlanProjection: vi.fn(),
  verifyPlanProjection: vi.fn()
}))
vi.mock('../../restore/planStore', () => ({
  mintPlanToken: vi.fn(),
  lookupPlanToken: vi.fn(),
  consumePlanToken: vi.fn()
}))
vi.mock('../../cost/compute', () => ({ computeCostDelta: vi.fn() }))
vi.mock('../../../cli/engine', () => ({ CliEngine: vi.fn() }))
vi.mock('../../../history/snapshotFile', () => ({
  SnapshotFileError: class SnapshotFileError extends Error {},
  parseSnapshotFile: vi.fn(),
  serializeSnapshotFile: vi.fn(),
  snapshotFileIdentity: vi.fn(),
  snapshotToFile: vi.fn()
}))
vi.mock('../../../scan/scanFile', () => ({
  ScanFileError: class ScanFileError extends Error {},
  buildScanFile: vi.fn(),
  parseScanFile: vi.fn(),
  scanFileDefaultName: vi.fn(),
  serializeScanFile: vi.fn()
}))

// ---- Import handlers after all mocks are in place ---------------------------
import { registerHandlers } from '../handlers'

describe('snapshot IPC handlers — demo-mode gate (RIFT-125)', () => {
  beforeEach(() => {
    // Clear the captured handler registry between runs.
    for (const key of Object.keys(handlers)) delete handlers[key]
    mockListVersionsSafe.mockReset()
    mockReadSnapshotSafe.mockReset()
    mockDeleteSnapshotSafe.mockReset()
    delete process.env['RIFTVIEW_DEMO_MODE']
  })

  afterEach(() => {
    delete process.env['RIFTVIEW_DEMO_MODE']
  })

  // Helper: set env, register handlers, return the three snapshot handlers.
  function setup(demoMode: boolean): {
    list: (...args: unknown[]) => unknown
    read: (...args: unknown[]) => unknown
    del: (...args: unknown[]) => unknown
  } {
    if (demoMode) {
      process.env['RIFTVIEW_DEMO_MODE'] = '1'
    } else {
      delete process.env['RIFTVIEW_DEMO_MODE']
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerHandlers(null as any)
    return {
      list: handlers['snapshot:list'],
      read: handlers['snapshot:read'],
      del: handlers['snapshot:delete']
    }
  }

  // Fake IPC event (unused in these handlers, but satisfies the signature).
  const evt = {} as Electron.IpcMainInvokeEvent

  // ---- Demo mode ON ----------------------------------------------------------
  describe('demo mode ON (RIFTVIEW_DEMO_MODE=1)', () => {
    it('snapshot:list returns [] and does not call the store', () => {
      const { list } = setup(true)
      const result = list(evt, undefined)
      expect(result).toEqual([])
      expect(mockListVersionsSafe).not.toHaveBeenCalled()
    })

    it('snapshot:read returns null and does not call the store', () => {
      const { read } = setup(true)
      const result = read(evt, 'some-version-id')
      expect(result).toBeNull()
      expect(mockReadSnapshotSafe).not.toHaveBeenCalled()
    })

    it('snapshot:delete returns { ok: false } and does not call the store', () => {
      const { del } = setup(true)
      const result = del(evt, 'some-version-id')
      expect(result).toEqual({ ok: false })
      expect(mockDeleteSnapshotSafe).not.toHaveBeenCalled()
    })
  })

  // ---- Demo mode OFF ---------------------------------------------------------
  describe('demo mode OFF (no env var)', () => {
    it('snapshot:list delegates to listVersionsSafe', () => {
      const fakeMeta = [{ versionId: 'v1', profile: 'default', region: 'us-east-1', createdAt: 0 }]
      mockListVersionsSafe.mockReturnValue(fakeMeta)
      const { list } = setup(false)
      const result = list(evt, undefined)
      expect(mockListVersionsSafe).toHaveBeenCalledTimes(1)
      expect(result).toEqual(fakeMeta)
    })

    it('snapshot:read delegates to readSnapshotSafe', () => {
      const fakeSnapshot = { versionId: 'v1', nodes: [], edges: [] }
      mockReadSnapshotSafe.mockReturnValue(fakeSnapshot)
      const { read } = setup(false)
      const result = read(evt, 'v1')
      expect(mockReadSnapshotSafe).toHaveBeenCalledTimes(1)
      expect(result).toEqual(fakeSnapshot)
    })

    it('snapshot:delete delegates to deleteSnapshotSafe', () => {
      mockDeleteSnapshotSafe.mockReturnValue({ ok: true })
      const { del } = setup(false)
      const result = del(evt, 'v1')
      expect(mockDeleteSnapshotSafe).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ ok: true })
    })
  })
})
