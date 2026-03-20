import { contextBridge, ipcRenderer } from 'electron'
import type { ScanDelta, AwsProfile } from '../renderer/types/cloud'
import type { CloudFrontParams } from '../renderer/types/create'
import type { CloudFrontEditParams } from '../renderer/types/edit'
import { IPC } from '../main/ipc/channels'

contextBridge.exposeInMainWorld('cloudblocks', {
  listProfiles: () => ipcRenderer.invoke(IPC.PROFILES_LIST),
  selectProfile: (profile: AwsProfile) => ipcRenderer.invoke(IPC.PROFILE_SELECT, profile),
  selectRegion: (region: string, endpoint?: string) => ipcRenderer.invoke(IPC.REGION_SELECT, { region, endpoint }),
  startScan: () => ipcRenderer.invoke(IPC.SCAN_START),

  onScanDelta: (cb: (delta: ScanDelta) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, delta: ScanDelta): void => cb(delta)
    ipcRenderer.on(IPC.SCAN_DELTA, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_DELTA, handler)
  },
  onScanStatus: (cb: (status: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string): void => cb(s)
    ipcRenderer.on(IPC.SCAN_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_STATUS, handler)
  },
  onConnStatus: (cb: (status: string) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, s: string): void => cb(s)
    ipcRenderer.on(IPC.CONN_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.CONN_STATUS, handler)
  },

  onScanKeypairs: (cb: (pairs: string[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, pairs: string[]): void => cb(pairs)
    ipcRenderer.on(IPC.SCAN_KEYPAIRS, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_KEYPAIRS, handler)
  },

  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (s: import('../renderer/types/cloud').Settings) => ipcRenderer.invoke(IPC.SETTINGS_SET, s),

  getThemeOverrides: () => ipcRenderer.invoke(IPC.THEME_OVERRIDES),

  // CLI — renderer sends pre-built string[][] argv arrays
  runCli: (commands: string[][]) => ipcRenderer.invoke(IPC.CLI_RUN, commands),
  cancelCli: () => ipcRenderer.send(IPC.CLI_CANCEL),
  onCliOutput: (cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { line: string; stream: 'stdout' | 'stderr' }): void => cb(data)
    ipcRenderer.on(IPC.CLI_OUTPUT, handler)
    return () => ipcRenderer.removeListener(IPC.CLI_OUTPUT, handler)
  },
  onCliDone: (cb: (data: { code: number }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { code: number }): void => cb(data)
    ipcRenderer.on(IPC.CLI_DONE, handler)
    return () => ipcRenderer.removeListener(IPC.CLI_DONE, handler)
  },

  // CloudFront SDK write operations
  createCloudFront:    (params: CloudFrontParams)                  => ipcRenderer.invoke(IPC.CF_CREATE, params),
  updateCloudFront:    (id: string, params: CloudFrontEditParams)  => ipcRenderer.invoke(IPC.CF_UPDATE, id, params),
  deleteCloudFront:    (id: string)                                => ipcRenderer.invoke(IPC.CF_DELETE, id),
  invalidateCloudFront:(id: string, cfPath: string)               => ipcRenderer.invoke(IPC.CF_INVALIDATE, id, cfPath),

  // ACM delete via CLI
  deleteAcm: (arn: string) => ipcRenderer.invoke(IPC.CLI_RUN, [['acm', 'delete-certificate', '--certificate-arn', arn]]),

  // Terraform HCL export
  exportTerraform: (nodes: import('../renderer/types/cloud').CloudNode[]) => ipcRenderer.invoke(IPC.TERRAFORM_EXPORT, nodes),

  // Canvas PNG export
  exportPng: (): Promise<{ success: boolean; filePath?: string }> => ipcRenderer.invoke(IPC.CANVAS_EXPORT_PNG),

  // List AWS credential profile names from ~/.aws/credentials
  listAwsProfiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.AWS_LIST_PROFILES),
})
