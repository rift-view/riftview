import { contextBridge, ipcRenderer } from 'electron'
import type { ScanDelta } from '../renderer/types/cloud'
import { IPC } from '../main/ipc/channels'

contextBridge.exposeInMainWorld('cloudblocks', {
  listProfiles: () => ipcRenderer.invoke(IPC.PROFILES_LIST),
  selectProfile: (name: string) => ipcRenderer.invoke(IPC.PROFILE_SELECT, name),
  selectRegion: (region: string) => ipcRenderer.invoke(IPC.REGION_SELECT, region),
  startScan: () => ipcRenderer.invoke(IPC.SCAN_START),

  onScanDelta: (cb: (delta: ScanDelta) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, delta: ScanDelta) => cb(delta)
    ipcRenderer.on(IPC.SCAN_DELTA, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_DELTA, handler)
  },
  onScanStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on(IPC.SCAN_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_STATUS, handler)
  },
  onConnStatus: (cb: (status: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string) => cb(s)
    ipcRenderer.on(IPC.CONN_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.CONN_STATUS, handler)
  },

  onScanKeypairs: (cb: (pairs: string[]) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, pairs: string[]) => cb(pairs)
    ipcRenderer.on(IPC.SCAN_KEYPAIRS, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_KEYPAIRS, handler)
  },

  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (s: unknown) => ipcRenderer.invoke(IPC.SETTINGS_SET, s),

  // CLI — renderer sends pre-built string[][] argv arrays
  runCli: (commands: string[][]) => ipcRenderer.invoke(IPC.CLI_RUN, commands),
  cancelCli: () => ipcRenderer.send(IPC.CLI_CANCEL),
  onCliOutput: (cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { line: string; stream: 'stdout' | 'stderr' }) => cb(data)
    ipcRenderer.on(IPC.CLI_OUTPUT, handler)
    return () => ipcRenderer.removeListener(IPC.CLI_OUTPUT, handler)
  },
  onCliDone: (cb: (data: { code: number }) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { code: number }) => cb(data)
    ipcRenderer.on(IPC.CLI_DONE, handler)
    return () => ipcRenderer.removeListener(IPC.CLI_DONE, handler)
  },
})
