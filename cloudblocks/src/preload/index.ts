import { contextBridge, ipcRenderer } from 'electron'
import type { ScanDelta, AwsProfile, NodeType } from '../renderer/types/cloud'
import type { CloudFrontParams } from '../renderer/types/create'
import type { CloudFrontEditParams } from '../renderer/types/edit'
import type { NodeTypeMetadata } from '../main/plugin/types'
import { IPC } from '../main/ipc/channels'

contextBridge.exposeInMainWorld('cloudblocks', {
  listProfiles: () => ipcRenderer.invoke(IPC.PROFILES_LIST),
  selectProfile: (profile: AwsProfile) => ipcRenderer.invoke(IPC.PROFILE_SELECT, profile),
  selectRegion: (region: string, endpoint?: string) => ipcRenderer.invoke(IPC.REGION_SELECT, { region, endpoint }),
  startScan: (selectedRegions?: string[]) => ipcRenderer.invoke(IPC.SCAN_START, selectedRegions ? { selectedRegions } : undefined),

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

  // Terraform LocalStack deploy
  terraformDeploy: (hcl: string, region: string, endpoint?: string) =>
    ipcRenderer.invoke(IPC.TERRAFORM_DEPLOY, hcl, region, endpoint),

  // Canvas PNG export
  exportPng: (): Promise<{ success: boolean; filePath?: string }> => ipcRenderer.invoke(IPC.CANVAS_EXPORT_PNG),

  // List AWS credential profile names from ~/.aws/credentials
  listAwsProfiles: (): Promise<string[]> => ipcRenderer.invoke(IPC.AWS_LIST_PROFILES),

  // Auto-updater push event
  onUpdateAvailable: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on(IPC.UPDATE_AVAILABLE, handler)
    return () => ipcRenderer.removeListener(IPC.UPDATE_AVAILABLE, handler)
  },

  // Annotations — persisted to userData/annotations.json
  loadAnnotations: (): Promise<Record<string, string>> => ipcRenderer.invoke(IPC.ANNOTATIONS_LOAD),
  saveAnnotations: (data: Record<string, string>): Promise<void> => ipcRenderer.invoke(IPC.ANNOTATIONS_SAVE, data),

  // Custom edges — persisted to userData/custom-edges.json
  loadCustomEdges: (): Promise<import('../renderer/types/cloud').CustomEdge[]> =>
    ipcRenderer.invoke(IPC.CUSTOM_EDGES_LOAD),
  saveCustomEdges: (edges: import('../renderer/types/cloud').CustomEdge[]): Promise<void> =>
    ipcRenderer.invoke(IPC.CUSTOM_EDGES_SAVE, edges),

  // Terraform state import
  importTfState: () => ipcRenderer.invoke(IPC.TFSTATE_IMPORT),
  clearTfState:  () => ipcRenderer.invoke(IPC.TFSTATE_CLEAR),

  // IAM Least-Privilege Advisor
  analyzeIam: (nodeId: string, nodeType: NodeType, metadata: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.IAM_ANALYZE, { nodeId, nodeType, metadata }),

  // OS drift notification
  notifyDrift: (count: number): Promise<void> => ipcRenderer.invoke(IPC.NOTIFY_DRIFT, count),

  // Plugin metadata — push: main → renderer
  onPluginMetadata: (cb: (meta: Record<string, NodeTypeMetadata>) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, meta: Record<string, NodeTypeMetadata>): void => cb(meta)
    ipcRenderer.on(IPC.PLUGIN_METADATA, handler)
    return () => ipcRenderer.removeListener(IPC.PLUGIN_METADATA, handler)
  },
})
