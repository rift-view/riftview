import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from './channels'
import { listProfiles, getDefaultRegion } from '../aws/credentials'
import { createClients } from '../aws/client'
import { ResourceScanner } from '../aws/scanner'
import { CliEngine } from '../cli/engine'
import { buildCommands } from '../../renderer/utils/buildCommand'
import type { CreateParams } from '../../renderer/types/create'

let scanner:   ResourceScanner | null = null
let cliEngine: CliEngine       | null = null

export function registerHandlers(win: BrowserWindow): void {
  // List available AWS profiles
  ipcMain.handle(IPC.PROFILES_LIST, () => listProfiles())

  // Select a profile — recreates clients + restarts scanner
  ipcMain.handle(IPC.PROFILE_SELECT, (_event, profileName: string) => {
    const region = getDefaultRegion(profileName)
    restartScanner(win, profileName, region)
  })

  // Select a region — recreates clients + restarts scanner with current profile
  ipcMain.handle(IPC.REGION_SELECT, (_event, region: string) => {
    const profile = process.env.AWS_PROFILE ?? 'default'
    restartScanner(win, profile, region)
  })

  // Manual scan trigger
  ipcMain.handle(IPC.SCAN_START, () => {
    scanner?.triggerManualScan()
  })

  // Run a write command — renderer sends CreateParams, main builds argv and executes
  ipcMain.handle(IPC.CLI_RUN, (_event, params: CreateParams) => {
    const commands = buildCommands(params)
    return cliEngine!.execute(commands)
  })

  // Cancel in-flight command (fire-and-forget, no return value needed)
  ipcMain.on(IPC.CLI_CANCEL, () => {
    cliEngine?.cancel()
  })

  // Initialise engine for the default session
  cliEngine = new CliEngine(win)
}

function restartScanner(win: BrowserWindow, profile: string, region: string): void {
  scanner?.stop()
  // Recreate engine to ensure it holds the current win reference after profile/region switch
  cliEngine = new CliEngine(win)
  const clients = createClients(profile, region)
  scanner = new ResourceScanner(clients, region, win)
  scanner.start()
}
