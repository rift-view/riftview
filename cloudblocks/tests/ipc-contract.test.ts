/**
 * IPC contract test — every invoke channel declared in channels.ts must have
 * a corresponding ipcMain.handle registration in handlers.ts.
 *
 * Push-only channels (main → renderer) and the fire-and-forget cli:cancel
 * channel are explicitly excluded from the coverage check.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IPC } from '../src/main/ipc/channels'

// Push-only channels that main sends to renderer — no handle registration expected
const PUSH_ONLY_CHANNELS = new Set<string>([
  IPC.SCAN_DELTA,
  IPC.SCAN_STATUS,
  IPC.CONN_STATUS,
  IPC.SCAN_KEYPAIRS,
  IPC.CLI_OUTPUT,
  IPC.CLI_DONE,
  IPC.UPDATE_AVAILABLE,
  IPC.PLUGIN_METADATA,
  IPC.TERMINAL_OUTPUT,
  IPC.SCAN_ERROR_DETAIL
])

// Fire-and-forget channel registered with ipcMain.on, not ipcMain.handle
const ON_CHANNELS = new Set<string>([IPC.CLI_CANCEL])

// Channels that require an invoke handler
const INVOKE_CHANNELS = Object.values(IPC).filter(
  (ch) => !PUSH_ONLY_CHANNELS.has(ch) && !ON_CHANNELS.has(ch)
)

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn().mockReturnValue('/tmp'), getVersion: vi.fn().mockReturnValue('0.0.0') },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  Notification: vi.fn(function () {
    return { show: vi.fn() }
  })
}))
vi.mock('../src/main/aws/credentials', () => ({
  listProfiles: vi.fn().mockReturnValue([]),
  getDefaultRegion: vi.fn().mockReturnValue('us-east-1')
}))
vi.mock('../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({})
}))
vi.mock('../src/main/aws/scanner', () => ({
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
vi.mock('../src/main/cli/engine', () => ({
  CliEngine: vi.fn(function () {
    return { execute: vi.fn(), cancel: vi.fn() }
  })
}))
vi.mock('../src/main/terraform/index', () => ({
  generateTerraformFile: vi.fn().mockReturnValue({ hcl: '', skippedTypes: [] })
}))
vi.mock('../src/main/terraform/provider', () => ({
  buildLocalStackProvider: vi.fn().mockReturnValue('')
}))
vi.mock('../src/main/aws/tfstate/parser', () => ({
  parseTfState: vi.fn().mockReturnValue([])
}))
vi.mock('../src/main/aws/iam/fetcher', () => ({
  fetchEc2IamData: vi.fn().mockResolvedValue([]),
  fetchLambdaIamData: vi.fn().mockResolvedValue([]),
  fetchS3IamData: vi.fn().mockResolvedValue([])
}))
vi.mock('@aws-sdk/client-cloudwatch', () => ({
  CloudWatchClient: vi.fn(function () {
    return {}
  })
}))
vi.mock('../src/main/aws/services/cloudwatch', () => ({
  fetchMetrics: vi.fn().mockResolvedValue([])
}))

import { ipcMain } from 'electron'
import { registerHandlers } from '../src/main/ipc/handlers'

describe('IPC contract — channels vs handlers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('every invoke channel declared in channels.ts has a registered handler', () => {
    const mockWin = {
      webContents: { send: vi.fn(), capturePage: vi.fn() },
      isFocused: vi.fn().mockReturnValue(true)
    } as unknown as Electron.BrowserWindow

    registerHandlers(mockWin)

    const handledChannels = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))

    const missing = INVOKE_CHANNELS.filter((ch) => !handledChannels.has(ch))

    expect(missing, `These invoke channels have no handler: ${missing.join(', ')}`).toHaveLength(0)
  })

  it('cli:cancel is registered with ipcMain.on, not ipcMain.handle', () => {
    const mockWin = {
      webContents: { send: vi.fn(), capturePage: vi.fn() },
      isFocused: vi.fn().mockReturnValue(true)
    } as unknown as Electron.BrowserWindow

    registerHandlers(mockWin)

    const onChannels = new Set(vi.mocked(ipcMain.on).mock.calls.map((c) => c[0] as string))
    const handleChannels = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))

    expect(onChannels.has(IPC.CLI_CANCEL)).toBe(true)
    expect(handleChannels.has(IPC.CLI_CANCEL)).toBe(false)
  })

  it('push-only channels are not accidentally registered as handlers', () => {
    const mockWin = {
      webContents: { send: vi.fn(), capturePage: vi.fn() },
      isFocused: vi.fn().mockReturnValue(true)
    } as unknown as Electron.BrowserWindow

    registerHandlers(mockWin)

    const handleChannels = new Set(vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0] as string))

    const wronglyHandled = [...PUSH_ONLY_CHANNELS].filter((ch) => handleChannels.has(ch))
    expect(
      wronglyHandled,
      `Push-only channels registered as handlers: ${wronglyHandled.join(', ')}`
    ).toHaveLength(0)
  })
})
