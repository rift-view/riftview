import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc/channels'
import type { AwsProfile, ScanDelta } from '../renderer/types/cloud'
import type { CreateParams } from '../renderer/types/create'

contextBridge.exposeInMainWorld('cloudblocks', {
  listProfiles: (): Promise<AwsProfile[]> =>
    ipcRenderer.invoke(IPC.PROFILES_LIST),

  selectProfile: (name: string): Promise<void> =>
    ipcRenderer.invoke(IPC.PROFILE_SELECT, name),

  selectRegion: (region: string): Promise<void> =>
    ipcRenderer.invoke(IPC.REGION_SELECT, region),

  startScan: (): Promise<void> =>
    ipcRenderer.invoke(IPC.SCAN_START),

  onScanDelta: (cb: (delta: ScanDelta) => void) => {
    ipcRenderer.on(IPC.SCAN_DELTA, (_event, delta) => cb(delta))
    return () => ipcRenderer.removeAllListeners(IPC.SCAN_DELTA)
  },

  onScanStatus: (cb: (status: string) => void) => {
    ipcRenderer.on(IPC.SCAN_STATUS, (_event, status) => cb(status))
    return () => ipcRenderer.removeAllListeners(IPC.SCAN_STATUS)
  },

  onConnStatus: (cb: (status: string) => void) => {
    ipcRenderer.on(IPC.CONN_STATUS, (_event, status) => cb(status))
    return () => ipcRenderer.removeAllListeners(IPC.CONN_STATUS)
  },

  runCli: (params: CreateParams): Promise<{ code: number }> =>
    ipcRenderer.invoke(IPC.CLI_RUN, params),

  cancelCli: (): void =>
    ipcRenderer.send(IPC.CLI_CANCEL),

  onCliOutput: (cb: (entry: { line: string; stream: 'stdout' | 'stderr' }) => void) => {
    ipcRenderer.on(IPC.CLI_OUTPUT, (_event, entry) => cb(entry))
    return () => ipcRenderer.removeAllListeners(IPC.CLI_OUTPUT)
  },

  onCliDone: (cb: (result: { code: number }) => void) => {
    ipcRenderer.on(IPC.CLI_DONE, (_event, result) => cb(result))
    return () => ipcRenderer.removeAllListeners(IPC.CLI_DONE)
  },
})

declare global {
  interface Window {
    cloudblocks: {
      listProfiles: () => Promise<AwsProfile[]>
      selectProfile: (name: string) => Promise<void>
      selectRegion: (region: string) => Promise<void>
      startScan: () => Promise<void>
      onScanDelta: (cb: (delta: ScanDelta) => void) => () => void
      onScanStatus: (cb: (status: string) => void) => () => void
      onConnStatus: (cb: (status: string) => void) => () => void
      runCli:      (params: CreateParams) => Promise<{ code: number }>
      cancelCli:   () => void
      onCliOutput: (cb: (entry: { line: string; stream: 'stdout' | 'stderr' }) => void) => () => void
      onCliDone:   (cb: (result: { code: number }) => void) => () => void
    }
  }
}
