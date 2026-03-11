import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from './channels'
import { listProfiles, getDefaultRegion } from '../aws/credentials'
import { createClients } from '../aws/client'
import { ResourceScanner } from '../aws/scanner'

let scanner: ResourceScanner | null = null

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
}

function restartScanner(win: BrowserWindow, profile: string, region: string): void {
  scanner?.stop()
  const clients = createClients(profile, region)
  scanner = new ResourceScanner(clients, region, win)
  scanner.start()
}
