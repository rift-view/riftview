import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
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
  ResourceScanner: vi.fn().mockImplementation(() => ({ start: vi.fn(), stop: vi.fn(), triggerManualScan: vi.fn() })),
}))

import { ipcMain } from 'electron'
import { registerHandlers } from '../../../src/main/ipc/handlers'

describe('registerHandlers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers all required IPC handlers', () => {
    const mockWin = { webContents: { send: vi.fn() } } as any
    registerHandlers(mockWin)
    const registeredChannels = vi.mocked(ipcMain.handle).mock.calls.map((c) => c[0])
    expect(registeredChannels).toContain('profiles:list')
    expect(registeredChannels).toContain('profile:select')
    expect(registeredChannels).toContain('region:select')
    expect(registeredChannels).toContain('scan:start')
  })

  it('profiles:list handler returns listProfiles result', async () => {
    const mockWin = { webContents: { send: vi.fn() } } as any
    registerHandlers(mockWin)
    const handler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'profiles:list')?.[1]
    expect(handler).toBeDefined()
    const result = await handler!({} as any)
    expect(result).toEqual([{ name: 'default' }])
  })
})
