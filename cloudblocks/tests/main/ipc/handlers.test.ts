import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
}))
vi.mock('../../../src/main/aws/credentials', () => ({
  listProfiles: vi.fn().mockReturnValue([{ name: 'default' }]),
  getDefaultRegion: vi.fn().mockReturnValue('us-east-1'),
}))
vi.mock('../../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({}),
}))
vi.mock('../../../src/main/aws/scanner', () => ({
  ResourceScanner: vi.fn(function () { return { start: vi.fn(), stop: vi.fn(), triggerManualScan: vi.fn(), updateRegions: vi.fn() } }),
}))
vi.mock('../../../src/main/cli/engine', () => ({
  CliEngine: vi.fn(function () { return { execute: vi.fn(), cancel: vi.fn() } }),
}))
vi.mock('../../../src/renderer/utils/buildCommand', () => ({
  buildCommands: vi.fn().mockReturnValue([]),
}))

import { ipcMain } from 'electron'
import { registerHandlers } from '../../../src/main/ipc/handlers'

describe('registerHandlers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers all required IPC handlers', () => {
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    registerHandlers(mockWin)
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0])
    expect(registeredChannels).toContain('profiles:list')
    expect(registeredChannels).toContain('profile:select')
    expect(registeredChannels).toContain('region:select')
    expect(registeredChannels).toContain('scan:start')
    expect(registeredChannels).toContain('cli:run')
    const onChannels = vi.mocked(ipcMain.on).mock.calls.map((c) => c[0])
    expect(onChannels).toContain('cli:cancel')
  })

  it('profiles:list handler returns listProfiles result', async () => {
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    registerHandlers(mockWin)
    const handler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'profiles:list')?.[1]
    expect(handler).toBeDefined()
    const result = await handler!({} as Electron.IpcMainInvokeEvent)
    expect(result).toEqual([{ name: 'default' }])
  })

  it('scan:start handler calls updateRegions when selectedRegions provided', async () => {
    const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
    registerHandlers(mockWin)

    // Initialize the scanner by calling profile:select first
    const profileSelectHandler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'profile:select')?.[1]
    expect(profileSelectHandler).toBeDefined()
    await profileSelectHandler!({} as Electron.IpcMainInvokeEvent, { name: 'default' })

    const handler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'scan:start')?.[1]
    expect(handler).toBeDefined()
    await handler!({} as Electron.IpcMainInvokeEvent, { selectedRegions: ['us-west-2'] })

    const { ResourceScanner } = await import('../../../src/main/aws/scanner')
    const mockInstance = vi.mocked(ResourceScanner).mock.results[0]?.value
    expect(mockInstance?.updateRegions).toHaveBeenCalledWith(['us-west-2'])
  })
})
