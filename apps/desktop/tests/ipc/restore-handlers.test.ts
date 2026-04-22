/**
 * Restore IPC handler registration — amendments (c) and (d) of RIF-20 2026-04-21.
 *
 * (c) When safeStorage.isEncryptionAvailable() is false, RESTORE_PLAN /
 *     RESTORE_CONFIRM_STEP / RESTORE_APPLY must NOT be registered.
 * (d) When RIFTVIEW_DEMO_MODE=1, ALL restore handlers must NOT be registered.
 *
 * The error shape is load-bearing: the renderer must see "No handler registered"
 * (handler absent), not "Demo mode: disabled" (handler present but denying).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IPC } from '../../src/main/ipc/channels'

const RESTORE_CHANNELS = [
  IPC.RESTORE_VERSIONS,
  IPC.RESTORE_PLAN,
  IPC.RESTORE_COST_ESTIMATE,
  IPC.RESTORE_CONFIRM_STEP,
  IPC.RESTORE_APPLY,
  IPC.RESTORE_CANCEL
] as const

const KEYCHAIN_GATED = [IPC.RESTORE_PLAN, IPC.RESTORE_CONFIRM_STEP, IPC.RESTORE_APPLY] as const

const mockWin = (): Electron.BrowserWindow =>
  ({
    webContents: { send: vi.fn(), capturePage: vi.fn() },
    isFocused: vi.fn().mockReturnValue(true)
  }) as unknown as Electron.BrowserWindow

interface ElectronMock {
  ipcMain: { handle: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> }
  BrowserWindow: ReturnType<typeof vi.fn>
  app: { getPath: ReturnType<typeof vi.fn>; getVersion: ReturnType<typeof vi.fn> }
  dialog: { showSaveDialog: ReturnType<typeof vi.fn>; showOpenDialog: ReturnType<typeof vi.fn> }
  Notification: ReturnType<typeof vi.fn>
  safeStorage: { isEncryptionAvailable: ReturnType<typeof vi.fn> }
}

// Base electron mock factory — lets individual tests override safeStorage
function makeElectronMock(encAvailable = true): ElectronMock {
  return {
    ipcMain: { handle: vi.fn(), on: vi.fn() },
    BrowserWindow: vi.fn(),
    app: { getPath: vi.fn().mockReturnValue('/tmp'), getVersion: vi.fn().mockReturnValue('0.0.0') },
    dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    Notification: vi.fn(function () {
      return { show: vi.fn() }
    }),
    safeStorage: { isEncryptionAvailable: vi.fn().mockReturnValue(encAvailable) }
  }
}

// Shared module mocks that don't change between tests
vi.mock('../../src/main/aws/credentials', () => ({
  listProfiles: vi.fn().mockReturnValue([]),
  getDefaultRegion: vi.fn().mockReturnValue('us-east-1')
}))
vi.mock('../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({})
}))
vi.mock('../../src/main/aws/scanner', () => ({
  ResourceScanner: vi.fn(function () {
    return {
      start: vi.fn(),
      stop: vi.fn(),
      triggerManualScan: vi.fn(),
      updateRegions: vi.fn(),
      updateInterval: vi.fn()
    }
  }),
  historyFilePath: vi.fn().mockReturnValue('/tmp/history/node.json')
}))
vi.mock('../../src/main/cli/engine', () => ({
  CliEngine: vi.fn(function () {
    return { execute: vi.fn(), cancel: vi.fn() }
  })
}))
vi.mock('../../src/main/terraform/index', () => ({
  generateTerraformFile: vi.fn().mockReturnValue({ hcl: '', skippedTypes: [] })
}))
vi.mock('../../src/main/terraform/provider', () => ({
  buildLocalStackProvider: vi.fn().mockReturnValue('')
}))
vi.mock('@riftview/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    parseTfState: vi.fn().mockReturnValue([]),
    parseTfStateModules: vi.fn().mockReturnValue([])
  }
})
vi.mock('../../src/main/aws/iam/fetcher', () => ({
  fetchEc2IamData: vi.fn().mockResolvedValue([]),
  fetchLambdaIamData: vi.fn().mockResolvedValue([]),
  fetchS3IamData: vi.fn().mockResolvedValue([])
}))
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn(function () {
    return {}
  })
}))
vi.mock('../../src/main/aws/services/cloudwatch', () => ({
  fetchMetrics: vi.fn().mockResolvedValue([])
}))

describe('restore handler registration — demo mode (amendment d)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('electron', () => makeElectronMock(true))
    process.env.RIFTVIEW_DEMO_MODE = '1'
  })

  it('no restore handlers are registered when RIFTVIEW_DEMO_MODE=1', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    registerHandlers(mockWin())
    const handled = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))
    const registered = RESTORE_CHANNELS.filter((ch) => handled.has(ch))
    expect(
      registered,
      `Restore channels must be absent in demo mode: ${registered.join(', ')}`
    ).toHaveLength(0)
    delete process.env.RIFTVIEW_DEMO_MODE
  })
})

describe('restore handler registration — keychain unavailable (amendment c)', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('electron', () => makeElectronMock(false))
    delete process.env.RIFTVIEW_DEMO_MODE
  })

  it('RESTORE_PLAN / RESTORE_CONFIRM_STEP / RESTORE_APPLY absent when keychain unavailable', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    registerHandlers(mockWin())
    const handled = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))
    const wronglyPresent = KEYCHAIN_GATED.filter((ch) => handled.has(ch))
    expect(
      wronglyPresent,
      `These channels must be absent when keychain unavailable: ${wronglyPresent.join(', ')}`
    ).toHaveLength(0)
  })

  it('RESTORE_VERSIONS / RESTORE_COST_ESTIMATE / RESTORE_CANCEL are still registered when keychain unavailable', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    registerHandlers(mockWin())
    const handled = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))
    const readOnlyChannels = [IPC.RESTORE_VERSIONS, IPC.RESTORE_COST_ESTIMATE, IPC.RESTORE_CANCEL]
    const missing = readOnlyChannels.filter((ch) => !handled.has(ch))
    expect(
      missing,
      `Read-only restore channels should still be registered: ${missing.join(', ')}`
    ).toHaveLength(0)
  })
})

describe('restore handler registration — normal mode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.doMock('electron', () => makeElectronMock(true))
    delete process.env.RIFTVIEW_DEMO_MODE
  })

  it('all restore invoke channels are registered when keychain available and not demo mode', async () => {
    const { ipcMain } = await import('electron')
    const { registerHandlers } = await import('../../src/main/ipc/handlers')
    registerHandlers(mockWin())
    const handled = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))
    const missing = RESTORE_CHANNELS.filter((ch) => !handled.has(ch))
    expect(missing, `Restore channels missing: ${missing.join(', ')}`).toHaveLength(0)
  })
})
