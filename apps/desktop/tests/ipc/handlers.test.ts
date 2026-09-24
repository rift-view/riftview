import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn().mockReturnValue('/tmp'), getVersion: vi.fn().mockReturnValue('0.0.0') },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  Notification: vi.fn(function () {
    return { show: vi.fn() }
  }),
  safeStorage: { isEncryptionAvailable: vi.fn().mockReturnValue(true) },
  shell: { openExternal: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('@riftview/shared', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    listProfiles: vi.fn().mockReturnValue([{ name: 'default' }]),
    getDefaultRegion: vi.fn().mockReturnValue('us-east-1')
  }
})
vi.mock('../../src/main/aws/client', () => ({
  createClients: vi.fn().mockReturnValue({})
}))
vi.mock('../../src/main/aws/scanner', () => ({
  ResourceScanner: vi.fn(function () {
    return { start: vi.fn(), stop: vi.fn(), triggerManualScan: vi.fn(), updateRegions: vi.fn() }
  })
}))
vi.mock('../../src/main/cli/engine', () => ({
  CliEngine: vi.fn(function () {
    return { execute: vi.fn(), cancel: vi.fn() }
  })
}))
vi.mock('../../src/renderer/utils/buildCommand', () => ({
  buildCommands: vi.fn().mockReturnValue([])
}))

import { ipcMain, app, shell } from 'electron'
import { registerHandlers } from '../../src/main/ipc/handlers'

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const mockWin = { webContents: { send: vi.fn() } } as unknown as Electron.BrowserWindow
  registerHandlers(mockWin)
  const handler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === channel)?.[1]
  expect(handler, `no handler registered for ${channel}`).toBeDefined()
  return handler as unknown as (...args: unknown[]) => unknown
}

const EVENT = {} as Electron.IpcMainInvokeEvent

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
    const profileSelectHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find((c) => c[0] === 'profile:select')?.[1]
    expect(profileSelectHandler).toBeDefined()
    await profileSelectHandler!({} as Electron.IpcMainInvokeEvent, { name: 'default' })

    const handler = vi.mocked(ipcMain.handle).mock.calls.find((c) => c[0] === 'scan:start')?.[1]
    expect(handler).toBeDefined()
    await handler!({} as Electron.IpcMainInvokeEvent, { selectedRegions: ['us-west-2'] })

    const { ResourceScanner } = await import('../../src/main/aws/scanner')
    const mockInstance = vi.mocked(ResourceScanner).mock.results[0]?.value
    expect(mockInstance?.updateRegions).toHaveBeenCalledWith(['us-west-2'])
  })
})

describe('tfstate:save-baseline (RIFT-146 path traversal guard)', () => {
  let userData: string

  beforeEach(() => {
    vi.clearAllMocks()
    userData = fs.mkdtempSync(path.join(os.tmpdir(), 'riftview-baseline-'))
    vi.mocked(app.getPath).mockReturnValue(userData)
  })

  afterEach(() => {
    vi.mocked(app.getPath).mockReturnValue('/tmp')
    fs.rmSync(userData, { recursive: true, force: true })
  })

  it('writes <userData>/baselines/<profile>-<region>.json for a normal profile', async () => {
    const handler = getHandler('tfstate:save-baseline')
    const nodes = [
      {
        id: 'i-1',
        type: 'aws:ec2',
        label: 'web',
        status: 'running',
        region: 'us-east-1',
        metadata: {}
      }
    ]
    expect(handler(EVENT, { nodes, profileName: 'default', region: 'us-east-1' })).toEqual({
      ok: true
    })
    const file = path.join(userData, 'baselines', 'default-us-east-1.json')
    expect(JSON.parse(fs.readFileSync(file, 'utf-8'))).toEqual(nodes)
  })

  it('keeps a traversal profileName inside the baselines directory', async () => {
    const handler = getHandler('tfstate:save-baseline')
    const escapeTarget = path.resolve(userData, 'baselines', '../../../../x-us-east-1.json')
    expect(
      handler(EVENT, { nodes: [], profileName: '../../../../x', region: 'us-east-1' })
    ).toEqual({ ok: true })
    // The only file written sits under baselines/ with the traversal
    // characters neutralised; nothing landed at the escape target.
    expect(fs.readdirSync(path.join(userData, 'baselines'))).toEqual([
      '____________x-us-east-1.json'
    ])
    expect(fs.existsSync(escapeTarget)).toBe(false)
  })

  it('refuses an empty profileName without touching the disk', async () => {
    const handler = getHandler('tfstate:save-baseline')
    expect(handler(EVENT, { nodes: [], profileName: '', region: 'us-east-1' })).toEqual({
      ok: false
    })
    expect(fs.existsSync(path.join(userData, 'baselines'))).toBe(false)
  })
})

describe('shell:open-external (RIFT-146)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('hands an allow-listed AWS console URL to shell.openExternal', async () => {
    const handler = getHandler('shell:open-external')
    const url = 'https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#Instances:'
    await expect(handler(EVENT, url)).resolves.toBe(true)
    expect(shell.openExternal).toHaveBeenCalledTimes(1)
    expect(shell.openExternal).toHaveBeenCalledWith(url)
  })

  it.each([
    'http://console.aws.amazon.com/',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,hi',
    'https://console.aws.amazon.com@evil.example/',
    'https://evil.example/'
  ])('refuses %s without touching the shell', async (url) => {
    const handler = getHandler('shell:open-external')
    await expect(handler(EVENT, url)).resolves.toBe(false)
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('refuses non-string payloads', async () => {
    const handler = getHandler('shell:open-external')
    for (const bad of [undefined, null, 42, { url: 'https://console.aws.amazon.com/' }]) {
      await expect(handler(EVENT, bad)).resolves.toBe(false)
    }
    expect(shell.openExternal).not.toHaveBeenCalled()
  })

  it('resolves false when the OS hand-off fails', async () => {
    const handler = getHandler('shell:open-external')
    vi.mocked(shell.openExternal).mockRejectedValueOnce(new Error('no browser'))
    await expect(handler(EVENT, 'https://console.aws.amazon.com/')).resolves.toBe(false)
  })
})
