import { contextBridge, ipcRenderer } from 'electron'
import type { ScanDelta, AwsProfile, NodeType } from '@riftview/shared'
import type { CloudFrontParams } from '../renderer/types/create'
import type { CloudFrontEditParams } from '../renderer/types/edit'
import type { NodeTypeMetadata } from '../main/plugin/types'
import { IPC } from '../main/ipc/channels'

// Amendment (d) — unified RIFTVIEW_DEMO_MODE capability flag.
// Read synchronously at preload init; no IPC round-trip.
// VITE_DEMO_MODE is retired from the gate path (may persist as a build-time UI
// hint only; main's flag is the security gate).
const _isDemoMode = process.env.RIFTVIEW_DEMO_MODE === '1'

// Expose capabilities synchronously so renderer reads them at first render
// without waiting for IPC readiness.
contextBridge.exposeInMainWorld('__riftviewCapabilities', { isDemoMode: _isDemoMode })

contextBridge.exposeInMainWorld('riftview', {
  // Runtime demo-mode flag — kept here for backwards compat with renderer UI reads.
  isDemoMode: _isDemoMode,

  listProfiles: () => ipcRenderer.invoke(IPC.PROFILES_LIST),
  selectProfile: (profile: AwsProfile) => ipcRenderer.invoke(IPC.PROFILE_SELECT, profile),
  selectRegion: (region: string, endpoint?: string) =>
    ipcRenderer.invoke(IPC.REGION_SELECT, { region, endpoint }),
  startScan: (selectedRegions?: string[]) =>
    ipcRenderer.invoke(IPC.SCAN_START, selectedRegions ? { selectedRegions } : undefined),

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
  onScanErrorDetail: (
    cb: (detail: { kind: string; message: string; raw: string }) => void
  ): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      detail: { kind: string; message: string; raw: string }
    ): void => cb(detail)
    ipcRenderer.on(IPC.SCAN_ERROR_DETAIL, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_ERROR_DETAIL, handler)
  },

  onScanKeypairs: (cb: (pairs: string[]) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, pairs: string[]): void => cb(pairs)
    ipcRenderer.on(IPC.SCAN_KEYPAIRS, handler)
    return () => ipcRenderer.removeListener(IPC.SCAN_KEYPAIRS, handler)
  },

  getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (s: import('@riftview/shared').Settings) => ipcRenderer.invoke(IPC.SETTINGS_SET, s),

  getStyleOverrides: () => ipcRenderer.invoke(IPC.STYLE_OVERRIDES),

  // CLI — renderer sends pre-built string[][] argv arrays
  runCli: (commands: string[][]) => ipcRenderer.invoke(IPC.CLI_RUN, commands),
  cancelCli: () => ipcRenderer.send(IPC.CLI_CANCEL),
  onCliOutput: (
    cb: (data: { line: string; stream: 'stdout' | 'stderr' }) => void
  ): (() => void) => {
    const handler = (
      _e: Electron.IpcRendererEvent,
      data: { line: string; stream: 'stdout' | 'stderr' }
    ): void => cb(data)
    ipcRenderer.on(IPC.CLI_OUTPUT, handler)
    return () => ipcRenderer.removeListener(IPC.CLI_OUTPUT, handler)
  },
  onCliDone: (cb: (data: { code: number }) => void): (() => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: { code: number }): void => cb(data)
    ipcRenderer.on(IPC.CLI_DONE, handler)
    return () => ipcRenderer.removeListener(IPC.CLI_DONE, handler)
  },

  // CloudFront SDK write operations
  createCloudFront: (params: CloudFrontParams) => ipcRenderer.invoke(IPC.CF_CREATE, params),
  updateCloudFront: (id: string, params: CloudFrontEditParams) =>
    ipcRenderer.invoke(IPC.CF_UPDATE, id, params),
  deleteCloudFront: (id: string) => ipcRenderer.invoke(IPC.CF_DELETE, id),
  invalidateCloudFront: (id: string, cfPath: string) =>
    ipcRenderer.invoke(IPC.CF_INVALIDATE, id, cfPath),

  // ACM delete via CLI
  deleteAcm: (arn: string) =>
    ipcRenderer.invoke(IPC.CLI_RUN, [['acm', 'delete-certificate', '--certificate-arn', arn]]),

  // Terraform HCL export
  exportTerraform: (nodes: import('@riftview/shared').CloudNode[]) =>
    ipcRenderer.invoke(IPC.TERRAFORM_EXPORT, nodes),

  // Terraform LocalStack deploy
  terraformDeploy: (hcl: string, region: string, endpoint?: string) =>
    ipcRenderer.invoke(IPC.TERRAFORM_DEPLOY, hcl, region, endpoint),

  // Canvas PNG export (legacy whole-window capture)
  exportPng: (): Promise<{ success: boolean; filePath?: string }> =>
    ipcRenderer.invoke(IPC.CANVAS_EXPORT_PNG),
  // Canvas image export — renderer captures via html-to-image, main process shows save dialog
  saveExportImage: (
    dataUrl: string,
    defaultName: string
  ): Promise<{ success: boolean; filePath?: string }> =>
    ipcRenderer.invoke(IPC.CANVAS_SAVE_IMAGE, dataUrl, defaultName),

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
  saveAnnotations: (data: Record<string, string>): Promise<void> =>
    ipcRenderer.invoke(IPC.ANNOTATIONS_SAVE, data),

  // Custom edges — persisted to userData/custom-edges.json
  loadCustomEdges: (): Promise<import('@riftview/shared').CustomEdge[]> =>
    ipcRenderer.invoke(IPC.CUSTOM_EDGES_LOAD),
  saveCustomEdges: (edges: import('@riftview/shared').CustomEdge[]): Promise<void> =>
    ipcRenderer.invoke(IPC.CUSTOM_EDGES_SAVE, edges),

  // Terraform state import
  importTfState: () => ipcRenderer.invoke(IPC.TFSTATE_IMPORT),
  clearTfState: () => ipcRenderer.invoke(IPC.TFSTATE_CLEAR),
  listTfStateModules: () => ipcRenderer.invoke(IPC.TFSTATE_LIST_MODULES),

  // IAM Least-Privilege Advisor
  analyzeIam: (nodeId: string, nodeType: NodeType, metadata: Record<string, unknown>) =>
    ipcRenderer.invoke(IPC.IAM_ANALYZE, { nodeId, nodeType, metadata }),

  // OS drift notification
  notifyDrift: (count: number): Promise<void> => ipcRenderer.invoke(IPC.NOTIFY_DRIFT, count),

  // Plugin metadata — push: main → renderer
  onPluginMetadata: (cb: (meta: Record<string, NodeTypeMetadata>) => void): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      meta: Record<string, NodeTypeMetadata>
    ): void => cb(meta)
    ipcRenderer.on(IPC.PLUGIN_METADATA, handler)
    return () => ipcRenderer.removeListener(IPC.PLUGIN_METADATA, handler)
  },

  // Save baseline for drift detection
  saveBaseline: (
    nodes: import('@riftview/shared').CloudNode[],
    profileName: string,
    region: string
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.TFSTATE_SAVE_BASELINE, { nodes, profileName, region }),

  // Retry a single scan service
  retryScanService: (service: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.SCAN_RETRY_SERVICE, { service }),

  // Validate AWS credentials via STS before scanning
  validateCredentials: (
    profile: AwsProfile
  ): Promise<{ ok: true; account: string; arn: string } | { ok: false; error: string }> =>
    ipcRenderer.invoke(IPC.CREDENTIALS_VALIDATE, profile),

  // CloudWatch metrics
  fetchMetrics: (params: {
    nodeId: string
    nodeType: string
    resourceId: string
    region: string
    profile: AwsProfile
  }) => ipcRenderer.invoke(IPC.METRICS_FETCH, params),

  // Per-node change history
  getNodeHistory: (nodeId: string) => ipcRenderer.invoke(IPC.HISTORY_GET, nodeId),

  // SSM terminal
  startTerminal: (params: { instanceId: string; region: string; profile: AwsProfile }) =>
    ipcRenderer.invoke(IPC.TERMINAL_START, params),
  sendTerminalInput: (sessionId: string, data: string) =>
    ipcRenderer.invoke(IPC.TERMINAL_INPUT, sessionId, data),
  resizeTerminal: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke(IPC.TERMINAL_RESIZE, sessionId, cols, rows),
  closeTerminal: (sessionId: string) => ipcRenderer.invoke(IPC.TERMINAL_CLOSE, sessionId),
  onTerminalOutput: (cb: (data: { sessionId: string; data: string }) => void): (() => void) => {
    const handler = (_: unknown, data: { sessionId: string; data: string }): void => cb(data)
    ipcRenderer.on(IPC.TERMINAL_OUTPUT, handler as Parameters<typeof ipcRenderer.on>[1])
    return () =>
      ipcRenderer.off(IPC.TERMINAL_OUTPUT, handler as Parameters<typeof ipcRenderer.off>[1])
  },

  // Snapshot history — read-only from renderer.
  listSnapshots: (filter?: { profile?: string; region?: string; limit?: number }) =>
    ipcRenderer.invoke(IPC.SNAPSHOT_LIST, filter),
  readSnapshot: (versionId: string) => ipcRenderer.invoke(IPC.SNAPSHOT_READ, versionId),
  deleteSnapshot: (versionId: string) => ipcRenderer.invoke(IPC.SNAPSHOT_DELETE, versionId),

  // Restore surface — structurally absent in demo mode (amendment d, RIF-20 2026-04-21).
  // Renderer probes window.riftview.restore === undefined as the capability check.
  // No "greyed-out" restore button — the whole surface is absent from preload.
  ...(_isDemoMode
    ? {}
    : {
        restore: {
          listVersions: (snapshotId: string) =>
            ipcRenderer.invoke(IPC.RESTORE_VERSIONS, snapshotId),
          planRestore: (snapshotId: string, versionId: string) =>
            ipcRenderer.invoke(IPC.RESTORE_PLAN, snapshotId, versionId),
          estimateCostDelta: (planToken: string) =>
            ipcRenderer.invoke(IPC.RESTORE_COST_ESTIMATE, planToken),
          confirmStep: (
            planToken: string,
            stepId: string,
            destructiveIds: string[],
            hmac: string,
            typedString: string
          ) =>
            ipcRenderer.invoke(
              IPC.RESTORE_CONFIRM_STEP,
              planToken,
              stepId,
              destructiveIds,
              hmac,
              typedString
            ),
          apply: (planToken: string, confirmationTokens: string[]) =>
            ipcRenderer.invoke(IPC.RESTORE_APPLY, planToken, confirmationTokens),
          cancel: (applyId: string) => ipcRenderer.invoke(IPC.RESTORE_CANCEL, applyId),
          onEvent: (
            cb: (event: {
              applyId: string
              stepId: string
              status: string
              message: string
            }) => void
          ): (() => void) => {
            const handler = (
              _: Electron.IpcRendererEvent,
              ev: { applyId: string; stepId: string; status: string; message: string }
            ): void => cb(ev)
            ipcRenderer.on(IPC.RESTORE_EVENT, handler)
            return () => ipcRenderer.removeListener(IPC.RESTORE_EVENT, handler)
          }
        }
      })
})
