import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import { ipcMain, BrowserWindow, app, dialog, Notification, safeStorage } from 'electron'
import { IPC } from './channels'
import { listProfiles, getDefaultRegion } from '@riftview/shared'
import { createClients, type AwsClients } from '@riftview/cloud-scan'
import { ResourceScanner, historyFilePath } from '../aws/scanner'
import {
  deleteSnapshotSafe,
  listVersionsSafe,
  readSnapshotSafe,
  writeSnapshotSafe,
  type Snapshot,
  type VersionMeta
} from '../history/index'
import {
  SnapshotFileError,
  parseSnapshotFile,
  serializeSnapshotFile,
  snapshotFileIdentity,
  snapshotToFile
} from '../history/snapshotFile'
import {
  ScanFileError,
  buildScanFile,
  parseScanFile,
  scanFileDefaultName,
  serializeScanFile,
  type ScanFileEdge
} from '../scan/scanFile'
import { CliEngine } from '../cli/engine'
import { pluginRegistry } from '@riftview/cloud-scan'
import {
  CreateDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  DeleteDistributionCommand,
  GetDistributionCommand,
  CreateInvalidationCommand
} from '@aws-sdk/client-cloudfront'
import type { CloudFrontParams } from '../../renderer/types/create'
import type { CloudFrontEditParams } from '../../renderer/types/edit'
import type { AwsProfile, CloudNode } from '@riftview/shared'
import { generateTerraformFile } from '../terraform/index'
import { execFile, spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import {
  fetchMetricsForProfile,
  type CloudMetric,
  validateAwsCredentials
} from '@riftview/cloud-scan'
import { buildLocalStackProvider } from '../terraform/provider'
const execFileAsync = promisify(execFile)
import { parseTfState, parseTfStateModules } from '@riftview/shared'
import { fetchEc2IamData, fetchLambdaIamData, fetchS3IamData } from '@riftview/cloud-scan'
import type { IamAnalysisResult } from '../../renderer/types/iam'
import type { NodeType } from '@riftview/shared'
import { isDemoMode } from '../capability'
import { signPlanProjection, verifyPlanProjection } from '../restore/hmac'
import { mintPlanToken, lookupPlanToken, consumePlanToken } from '../restore/planStore'
import { computeCostDelta } from '../cost/compute'

type TerraformDeployResult =
  | { status: 'success'; output: string }
  | { status: 'error'; output: string }
  | { status: 'not_found' }

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as 15 | 30 | 60 | 'manual',
  theme: 'dark' as const,
  showRegionIndicators: true,
  regionColors: {} as Record<string, string>,
  showScanErrorBadges: true,
  notifyOnDrift: true
}

let scanner: ResourceScanner | null = null
let cliEngine: CliEngine | null = null
let clients: AwsClients | null = null
let activeProfile: string = 'default'
let activeEndpoint: string | undefined
let activeRegions: string[] = ['us-east-1']

// --- Terminal sessions ---
const terminalSessions = new Map<string, ChildProcess>()

// Reference to the main window — set in registerHandlers
let mainWindow: BrowserWindow | null = null

export function registerHandlers(win: BrowserWindow): void {
  mainWindow = win

  // List available AWS profiles
  ipcMain.handle(IPC.PROFILES_LIST, () => listProfiles())

  // Select a profile — recreates clients + restarts scanner
  ipcMain.handle(IPC.PROFILE_SELECT, async (_event, profile: AwsProfile) => {
    const region = getDefaultRegion(profile.name)
    await restartScanner(win, profile.name, [region], profile.endpoint)
  })

  // Select a region — recreates clients + restarts scanner with current profile
  ipcMain.handle(
    IPC.REGION_SELECT,
    async (_event, { region, endpoint }: { region: string; endpoint?: string }) => {
      const profile = process.env.AWS_PROFILE ?? 'default'
      await restartScanner(win, profile, [region], endpoint)
    }
  )

  // Manual scan trigger — renderer may pass selectedRegions to refresh the scanner's region list.
  // When new regions are supplied, activate credentials for those regions before scanning.
  ipcMain.handle(IPC.SCAN_START, async (_event, payload?: { selectedRegions?: string[] }) => {
    if (payload?.selectedRegions && payload.selectedRegions.length > 0 && scanner) {
      await pluginRegistry.activateAll(activeProfile, payload.selectedRegions, activeEndpoint)
      scanner.updateRegions(payload.selectedRegions)
    }
    scanner?.triggerManualScan()
  })

  // Run a write command — renderer sends pre-built string[][] argv arrays
  ipcMain.handle(IPC.CLI_RUN, async (_, commands: string[][]) => {
    if (!cliEngine) return { code: 1 }
    return cliEngine.execute(commands)
  })

  // Settings — persist to userData/settings.json
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    try {
      const raw = fs.readFileSync(settingsPath(), 'utf-8')
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  ipcMain.handle(IPC.SETTINGS_SET, (_e, settings) => {
    try {
      fs.mkdirSync(path.dirname(settingsPath()), { recursive: true })
      fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
    } catch (err) {
      console.error('Failed to write settings:', err)
    }
    // Apply new scan interval immediately without restarting the scanner
    if (scanner && settings?.scanInterval !== undefined) {
      const raw = settings.scanInterval
      const intervalMs: number | 'manual' = raw === 'manual' ? 'manual' : (raw as number) * 1000
      scanner.updateInterval(intervalMs)
    }
  })

  ipcMain.handle(IPC.STYLE_OVERRIDES, () => {
    const file = path.join(app.getPath('userData'), 'overrides.json')
    try {
      const raw = fs.readFileSync(file, 'utf-8')
      return JSON.parse(raw) as Record<string, string>
    } catch {
      return {}
    }
  })

  // Cancel in-flight command (fire-and-forget, no return value needed)
  ipcMain.on(IPC.CLI_CANCEL, () => {
    cliEngine?.cancel()
  })

  // CloudFront SDK write handlers
  ipcMain.handle(IPC.CF_CREATE, async (_e, params: CloudFrontParams) => {
    if (!clients?.cloudfront) return { code: 1, error: 'No CloudFront client' }
    try {
      const origins = params.origins.map((o) => ({
        Id: o.id,
        DomainName: o.domainName,
        S3OriginConfig: { OriginAccessIdentity: '' }
      }))
      const viewerCertificate = params.certArn
        ? {
            ACMCertificateArn: params.certArn,
            SSLSupportMethod: 'sni-only' as const,
            MinimumProtocolVersion: 'TLSv1.2_2021' as const
          }
        : { CloudFrontDefaultCertificate: true }

      await clients.cloudfront.send(
        new CreateDistributionCommand({
          DistributionConfig: {
            CallerReference: Date.now().toString(),
            Comment: params.comment,
            DefaultRootObject: params.defaultRootObject,
            PriceClass: params.priceClass as import('@aws-sdk/client-cloudfront').PriceClass,
            Enabled: true,
            Origins: { Quantity: origins.length, Items: origins },
            DefaultCacheBehavior: {
              TargetOriginId: params.origins[0]?.id ?? 'default',
              ViewerProtocolPolicy: 'redirect-to-https',
              CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized managed policy
              AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] }
            },
            ViewerCertificate: viewerCertificate
          }
        })
      )
      return { code: 0 }
    } catch (err) {
      console.error('CF_CREATE error:', err)
      return { code: 1, error: String(err) }
    }
  })

  ipcMain.handle(IPC.CF_UPDATE, async (_e, id: string, params: CloudFrontEditParams) => {
    if (!clients?.cloudfront) return { code: 1, error: 'No CloudFront client' }
    try {
      const configRes = await clients.cloudfront.send(new GetDistributionConfigCommand({ Id: id }))
      const config = configRes.DistributionConfig
      const etag = configRes.ETag
      if (!config || !etag) return { code: 1, error: 'Could not fetch distribution config' }

      if (params.comment !== undefined) config.Comment = params.comment
      if (params.defaultRootObject !== undefined)
        config.DefaultRootObject = params.defaultRootObject
      if (params.priceClass !== undefined)
        config.PriceClass = params.priceClass as import('@aws-sdk/client-cloudfront').PriceClass
      if (params.certArn !== undefined) {
        config.ViewerCertificate = params.certArn
          ? {
              ACMCertificateArn: params.certArn,
              SSLSupportMethod: 'sni-only',
              MinimumProtocolVersion: 'TLSv1.2_2021'
            }
          : { CloudFrontDefaultCertificate: true }
      }

      await clients.cloudfront.send(
        new UpdateDistributionCommand({
          Id: id,
          IfMatch: etag,
          DistributionConfig: config
        })
      )
      return { code: 0 }
    } catch (err) {
      console.error('CF_UPDATE error:', err)
      return { code: 1, error: String(err) }
    }
  })

  ipcMain.handle(IPC.CF_DELETE, async (_e, id: string) => {
    if (!clients?.cloudfront) return { code: 1, error: 'No CloudFront client' }
    try {
      // Get config + ETag
      const configRes = await clients.cloudfront.send(new GetDistributionConfigCommand({ Id: id }))
      const config = configRes.DistributionConfig
      let etag = configRes.ETag
      if (!config || !etag) return { code: 1, error: 'Could not fetch distribution config' }

      // If enabled, disable first
      if (config.Enabled) {
        config.Enabled = false
        const updateRes = await clients.cloudfront.send(
          new UpdateDistributionCommand({
            Id: id,
            IfMatch: etag,
            DistributionConfig: config
          })
        )
        etag = updateRes.ETag

        // Poll until Deployed (5s intervals, 12 attempts max)
        let deployed = false
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 5000))
          const statusRes = await clients!.cloudfront.send(new GetDistributionCommand({ Id: id }))
          etag = statusRes.ETag ?? etag
          if (statusRes.Distribution?.Status === 'Deployed') {
            deployed = true
            break
          }
        }
        if (!deployed) return { code: 1, error: 'Timeout waiting for distribution to disable' }
      }

      await clients.cloudfront.send(new DeleteDistributionCommand({ Id: id, IfMatch: etag }))
      return { code: 0 }
    } catch (err) {
      console.error('CF_DELETE error:', err)
      return { code: 1, error: String(err) }
    }
  })

  ipcMain.handle(IPC.CF_INVALIDATE, async (_e, id: string, cfPath: string) => {
    if (!clients?.cloudfront) return { code: 1, error: 'No CloudFront client' }
    try {
      await clients.cloudfront.send(
        new CreateInvalidationCommand({
          DistributionId: id,
          InvalidationBatch: {
            Paths: { Quantity: 1, Items: [cfPath] },
            CallerReference: Date.now().toString()
          }
        })
      )
      return { code: 0 }
    } catch (err) {
      console.error('CF_INVALIDATE error:', err)
      return { code: 1, error: String(err) }
    }
  })

  // Canvas PNG export — capture the window and open a native save dialog
  ipcMain.handle(IPC.CANVAS_EXPORT_PNG, async () => {
    try {
      const image = await win.webContents.capturePage()
      const { filePath } = await dialog.showSaveDialog(win, {
        defaultPath: 'riftview-export.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      })
      if (!filePath) return { success: false }
      fs.writeFileSync(filePath, image.toPNG())
      return { success: true, filePath }
    } catch (err) {
      console.error('CANVAS_EXPORT_PNG error:', err)
      return { success: false }
    }
  })

  // Canvas image export — receive data URL from renderer, show native save dialog
  ipcMain.handle(IPC.CANVAS_SAVE_IMAGE, async (_e, dataUrl: string, defaultName: string) => {
    try {
      const { filePath } = await dialog.showSaveDialog(win, {
        defaultPath: defaultName,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      })
      if (!filePath) return { success: false }
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
      fs.writeFileSync(filePath, Buffer.from(base64, 'base64'))
      return { success: true, filePath }
    } catch (err) {
      console.error('CANVAS_SAVE_IMAGE error:', err)
      return { success: false }
    }
  })

  // Terraform HCL export — generate file and open native save dialog
  ipcMain.handle(IPC.TERRAFORM_EXPORT, async (_e, nodes: CloudNode[]) => {
    try {
      const { hcl, skippedTypes } = generateTerraformFile(nodes)
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: 'main.tf',
        filters: [{ name: 'Terraform', extensions: ['tf'] }]
      })
      if (!filePath) return { success: false }
      await fsp.writeFile(filePath, hcl, 'utf-8')
      return { success: true, skippedTypes: skippedTypes.length > 0 ? skippedTypes : undefined }
    } catch (err) {
      console.error('TERRAFORM_EXPORT error:', err)
      return { success: false }
    }
  })

  // Terraform LocalStack deploy — write config to temp dir, run init + apply
  ipcMain.handle(
    IPC.TERRAFORM_DEPLOY,
    async (
      _,
      hcl: string,
      region: string,
      endpoint = 'http://localhost:4566'
    ): Promise<TerraformDeployResult> => {
      // 1. Check binary
      try {
        await execFileAsync('terraform', ['version'], { timeout: 5000 })
      } catch {
        return { status: 'not_found' }
      }

      // 2. Write full config to temp dir
      const deployDir = path.join(app.getPath('userData'), 'terraform-deployments', randomUUID())
      await fsp.mkdir(deployDir, { recursive: true })
      const configPath = path.join(deployDir, 'main.tf')
      await fsp.writeFile(
        configPath,
        buildLocalStackProvider(region, endpoint) + '\n' + hcl,
        'utf-8'
      )

      const baseOpts = { cwd: deployDir, maxBuffer: 10 * 1024 * 1024 }
      let output = ''

      try {
        // 3. terraform init
        const initResult = await execFileAsync('terraform', ['init', '-input=false', '-no-color'], {
          ...baseOpts,
          timeout: 3 * 60 * 1000
        })
        output += initResult.stdout + initResult.stderr

        // 4. terraform apply
        const applyResult = await execFileAsync(
          'terraform',
          ['apply', '-auto-approve', '-no-color'],
          { ...baseOpts, timeout: 5 * 60 * 1000 }
        )
        output += applyResult.stdout + applyResult.stderr

        // 5. Cleanup on success
        await fsp.rm(deployDir, { recursive: true, force: true })

        return { status: 'success', output }
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string }
        output += (e.stdout ?? '') + (e.stderr ?? '')
        if (!output) output = e.message ?? 'Unknown error'
        // Leave temp dir on failure for debugging
        return { status: 'error', output }
      }
    }
  )

  // Annotations — persist to userData/annotations.json
  ipcMain.handle(IPC.ANNOTATIONS_LOAD, (): Record<string, string> => {
    const file = path.join(app.getPath('userData'), 'annotations.json')
    if (!fs.existsSync(file)) return {}
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch {
      return {}
    }
  })

  ipcMain.handle(IPC.ANNOTATIONS_SAVE, (_event, data: Record<string, string>): void => {
    const file = path.join(app.getPath('userData'), 'annotations.json')
    fs.writeFileSync(file, JSON.stringify(data), 'utf-8')
  })

  // Custom edges — persist to userData/custom-edges.json
  ipcMain.handle(IPC.CUSTOM_EDGES_LOAD, () => {
    const file = path.join(app.getPath('userData'), 'custom-edges.json')
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'))
    } catch {
      return []
    }
  })

  ipcMain.handle(IPC.CUSTOM_EDGES_SAVE, (_event, edges: unknown) => {
    const file = path.join(app.getPath('userData'), 'custom-edges.json')
    fsp.writeFile(file, JSON.stringify(edges, null, 2)).catch(() => {})
  })

  // Terraform state import — open a native file dialog and parse the .tfstate
  ipcMain.handle(IPC.TFSTATE_IMPORT, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Terraform State', extensions: ['tfstate', 'json'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { nodes: [] }
    try {
      const raw = await fsp.readFile(filePaths[0], 'utf-8')
      const nodes = parseTfState(raw)
      return { nodes }
    } catch (err) {
      return { nodes: [], error: (err as Error).message }
    }
  })

  ipcMain.handle(IPC.TFSTATE_CLEAR, () => ({ ok: true }))

  // E2E-only: parse a tfstate at the provided path without a file dialog.
  // Gated on RIFTVIEW_E2E=1; unregistered in production so the channel is
  // unreachable from a non-test renderer build.
  if (process.env.RIFTVIEW_E2E === '1') {
    ipcMain.handle(IPC.E2E_IMPORT_TFSTATE, async (_event, tfstatePath: unknown) => {
      if (typeof tfstatePath !== 'string' || tfstatePath.length === 0) {
        throw new Error('E2E_IMPORT_TFSTATE: path must be a non-empty string')
      }
      const raw = await fsp.readFile(tfstatePath, 'utf-8')
      return parseTfState(raw)
    })
  }

  // List modules in a tfstate file — opens native file dialog, groups resources by module segment
  ipcMain.handle(IPC.TFSTATE_LIST_MODULES, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ name: 'Terraform State', extensions: ['tfstate', 'json'] }],
      properties: ['openFile']
    })
    if (canceled || !filePaths[0]) return { modules: [] }
    try {
      const raw = await fsp.readFile(filePaths[0], 'utf-8')
      const modules = parseTfStateModules(raw)
      return { modules }
    } catch (err) {
      return { modules: [], error: (err as Error).message }
    }
  })

  // Save baseline — persist current cloud nodes as drift reference
  ipcMain.handle(
    IPC.TFSTATE_SAVE_BASELINE,
    (
      _event,
      { nodes, profileName, region }: { nodes: CloudNode[]; profileName: string; region: string }
    ): { ok: boolean } => {
      try {
        const dir = path.join(app.getPath('userData'), 'baselines')
        fs.mkdirSync(dir, { recursive: true })
        const file = path.join(dir, `${profileName}-${region}.json`)
        fs.writeFileSync(file, JSON.stringify(nodes, null, 2), 'utf-8')
        return { ok: true }
      } catch (err) {
        console.error('TFSTATE_SAVE_BASELINE error:', err)
        return { ok: false }
      }
    }
  )

  // List AWS credential profiles from ~/.aws/credentials
  ipcMain.handle(IPC.AWS_LIST_PROFILES, (): string[] => {
    const credFile = path.join(os.homedir(), '.aws', 'credentials')
    try {
      const raw = fs.readFileSync(credFile, 'utf-8')
      const profiles: string[] = []
      for (const line of raw.split('\n')) {
        const match = /^\[([^\]]+)\]/.exec(line.trim())
        if (match) profiles.push(match[1])
      }
      return profiles.length > 0 ? profiles : ['default']
    } catch {
      return ['default']
    }
  })

  // IAM Least-Privilege Advisor
  ipcMain.handle(
    IPC.IAM_ANALYZE,
    async (
      _event,
      {
        nodeId,
        nodeType,
        metadata
      }: { nodeId: string; nodeType: NodeType; metadata: Record<string, unknown> }
    ): Promise<IamAnalysisResult> => {
      if (!clients) {
        return {
          nodeId,
          findings: [],
          error: 'No AWS client — connect first',
          fetchedAt: Date.now()
        }
      }

      const node = {
        id: nodeId,
        type: nodeType,
        metadata
      } as import('@riftview/shared').CloudNode

      const timeoutPromise = new Promise<IamAnalysisResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              nodeId,
              findings: [],
              error: 'IAM analysis timed out after 10s',
              fetchedAt: Date.now()
            }),
          10_000
        )
      )

      const analyzePromise = (async (): Promise<IamAnalysisResult> => {
        try {
          let findings
          if (nodeType === 'aws:ec2') findings = await fetchEc2IamData(node, clients!)
          else if (nodeType === 'aws:lambda') findings = await fetchLambdaIamData(node, clients!)
          else if (nodeType === 'aws:s3') findings = await fetchS3IamData(node, clients!)
          else findings = []
          return { nodeId, findings, fetchedAt: Date.now() }
        } catch (err) {
          return { nodeId, findings: [], error: (err as Error).message, fetchedAt: Date.now() }
        }
      })()

      return Promise.race([analyzePromise, timeoutPromise])
    }
  )

  // OS-level drift notification — only fires when window is not focused
  ipcMain.handle(IPC.NOTIFY_DRIFT, (_event, count: number): void => {
    const w = BrowserWindow.getAllWindows()[0]
    if (w && !w.isFocused()) {
      new Notification({
        title: 'RiftView — Drift Detected',
        body: `${count} resource${count === 1 ? '' : 's'} drifted from Terraform state`
      }).show()
    }
  })

  // Retry a single scan service — runs only that service's scanner for the primary
  // active region, pushes a scoped SCAN_DELTA to the renderer, and returns ok:true
  // if the service no longer produces an error.
  ipcMain.handle(
    IPC.SCAN_RETRY_SERVICE,
    async (_event, { service }: { service: string }): Promise<{ ok: boolean }> => {
      if (!scanner) return { ok: false }
      try {
        const region = activeRegions[0] ?? 'us-east-1'
        const result = await pluginRegistry.scanService(service, region)
        if (!result) return { ok: false }
        const existingErrors = scanner.currentScanErrors
        scanner.applyServiceRetry(result.nodes, result.errors, existingErrors, service)
        const stillErrored = result.errors.some((e) => e.service === service)
        return { ok: !stillErrored }
      } catch {
        return { ok: false }
      }
    }
  )

  // Validate AWS credentials via STS GetCallerIdentity — called before scan
  ipcMain.handle(
    IPC.CREDENTIALS_VALIDATE,
    async (
      _event,
      profile: AwsProfile
    ): Promise<{ ok: true; account: string; arn: string } | { ok: false; error: string }> => {
      return validateAwsCredentials(profile)
    }
  )

  // CloudWatch metrics fetch
  ipcMain.handle(
    IPC.METRICS_FETCH,
    async (
      _,
      params: {
        nodeId: string
        nodeType: string
        resourceId: string
        region: string
        profile: AwsProfile
      }
    ): Promise<CloudMetric[]> => {
      if (!params.profile.endpoint) process.env.AWS_PROFILE = params.profile.name
      return fetchMetricsForProfile({
        nodeType: params.nodeType,
        resourceId: params.resourceId,
        region: params.region,
        endpoint: params.profile.endpoint
      })
    }
  )

  // Per-node change history — reads from disk
  ipcMain.handle(
    IPC.HISTORY_GET,
    async (
      _,
      nodeId: string
    ): Promise<
      Array<{ timestamp: string; changes: Array<{ field: string; before: string; after: string }> }>
    > => {
      try {
        const data = await fsp.readFile(historyFilePath(nodeId), 'utf8')
        return JSON.parse(data)
      } catch {
        return []
      }
    }
  )

  // Snapshot history — read-only from renderer.
  // Input validation + error isolation live in history/store.ts so malformed
  // payloads never reach the DB layer.
  ipcMain.handle(IPC.SNAPSHOT_LIST, (_, filter?: unknown): VersionMeta[] => {
    try {
      return listVersionsSafe(filter)
    } catch (err) {
      console.error('[ipc] snapshot:list rejected', err)
      return []
    }
  })

  ipcMain.handle(IPC.SNAPSHOT_READ, (_, versionId: unknown): Snapshot | null => {
    try {
      return readSnapshotSafe(versionId)
    } catch (err) {
      console.error('[ipc] snapshot:read rejected', err)
      return null
    }
  })

  ipcMain.handle(IPC.SNAPSHOT_DELETE, (_, versionId: unknown): { ok: boolean } => {
    try {
      return deleteSnapshotSafe(versionId)
    } catch (err) {
      console.error('[ipc] snapshot:delete rejected', err)
      return { ok: false }
    }
  })

  // RIFT-40: Export + Import file-bridge channels.
  // Structurally absent in demo mode per SecOps — redaction pass-through is a
  // future decision and the safe default is to hide the surface entirely.
  // We never log snapshot contents here — only { ok, path, versionId, code }.
  if (!isDemoMode()) {
    ipcMain.handle(
      IPC.SNAPSHOT_EXPORT,
      async (
        _,
        args: unknown
      ): Promise<{ ok: true; path: string } | { ok: false; error: string; code?: string }> => {
        try {
          if (
            !args ||
            typeof args !== 'object' ||
            typeof (args as { versionId?: unknown }).versionId !== 'string'
          ) {
            return { ok: false, error: 'versionId is required', code: 'invalid_args' }
          }
          const versionId = (args as { versionId: string }).versionId
          const snap = readSnapshotSafe(versionId)
          if (!snap) {
            return { ok: false, error: 'snapshot not found', code: 'not_found' }
          }

          const defaultName = `riftview-${snap.meta.profile}-${snap.meta.region}-${snap.meta.timestamp.replace(/[:.]/g, '-')}.json`
          const dlgResult = mainWindow
            ? await dialog.showSaveDialog(mainWindow, {
                defaultPath: defaultName,
                filters: [{ name: 'RiftView Snapshot', extensions: ['json'] }]
              })
            : await dialog.showSaveDialog({
                defaultPath: defaultName,
                filters: [{ name: 'RiftView Snapshot', extensions: ['json'] }]
              })

          if (dlgResult.canceled || !dlgResult.filePath) {
            return { ok: false, error: 'cancelled', code: 'cancelled' }
          }

          const file = snapshotToFile(snap)
          const text = serializeSnapshotFile(file)
          await fsp.writeFile(dlgResult.filePath, text, 'utf-8')
          console.log('[ipc] snapshot:export ok', { path: dlgResult.filePath, versionId })
          return { ok: true, path: dlgResult.filePath }
        } catch (err) {
          const code =
            err instanceof SnapshotFileError ? err.code : (err as NodeJS.ErrnoException).code
          console.error('[ipc] snapshot:export failed', { code })
          return { ok: false, error: (err as Error).message ?? 'export failed', code }
        }
      }
    )

    ipcMain.handle(
      IPC.SNAPSHOT_IMPORT,
      async (): Promise<
        | {
            ok: true
            versionId: string
            accountMismatch?: { fileProfile: string; activeProfile: string }
          }
        | { ok: false; error: string; code?: string }
      > => {
        try {
          const dlgResult = mainWindow
            ? await dialog.showOpenDialog(mainWindow, {
                filters: [{ name: 'RiftView Snapshot', extensions: ['json'] }],
                properties: ['openFile']
              })
            : await dialog.showOpenDialog({
                filters: [{ name: 'RiftView Snapshot', extensions: ['json'] }],
                properties: ['openFile']
              })
          if (dlgResult.canceled || !dlgResult.filePaths[0]) {
            return { ok: false, error: 'cancelled', code: 'cancelled' }
          }
          const raw = await fsp.readFile(dlgResult.filePaths[0], 'utf-8')
          const file = parseSnapshotFile(raw)
          const identity = snapshotFileIdentity(file)

          // Preserve the file's scannedAt as the canonical timestamp — the
          // operator is importing *history*, not registering a new scan.
          const fileDate = new Date(file.timestamp)
          const writeResult = writeSnapshotSafe(
            {
              profile: identity.profile,
              endpoint: identity.endpoint,
              regions: file.regions.length > 0 ? file.regions : [identity.region || 'unknown'],
              pluginId: 'com.riftview.aws',
              pluginVersion: app.getVersion(),
              scanErrors: (file.scanErrors ?? []).map(
                (e) => `${e.service ?? 'unknown'}/${e.region ?? 'unknown'}: ${e.message}`
              ),
              nodes: file.nodes
            },
            50,
            () => fileDate
          )

          if (!writeResult || writeResult.versionIds.length === 0) {
            return { ok: false, error: 'failed to persist imported snapshot', code: 'db_write' }
          }

          const versionId = writeResult.versionIds[0]
          const active = activeProfile
          const mismatch =
            identity.profile && active && identity.profile !== active
              ? { fileProfile: identity.profile, activeProfile: active }
              : undefined

          console.log('[ipc] snapshot:import ok', { versionId, accountMismatch: Boolean(mismatch) })
          return mismatch
            ? { ok: true, versionId, accountMismatch: mismatch }
            : { ok: true, versionId }
        } catch (err) {
          const code =
            err instanceof SnapshotFileError ? err.code : (err as NodeJS.ErrnoException).code
          console.error('[ipc] snapshot:import failed', { code })
          return { ok: false, error: (err as Error).message ?? 'import failed', code }
        }
      }
    )

    // RIFT-77: live current-scan file bridge. Distinct from the snapshot-file
    // handlers above — this round-trips the renderer's in-memory scan slot,
    // doesn't touch SQLite. Same demo-mode gate applies.
    ipcMain.handle(
      IPC.SCAN_EXPORT_JSON,
      async (
        _,
        args: unknown
      ): Promise<{ ok: true; path: string } | { ok: false; error: string; code?: string }> => {
        try {
          if (!args || typeof args !== 'object') {
            return { ok: false, error: 'args must be an object', code: 'invalid_args' }
          }
          const a = args as {
            nodes?: unknown
            scannedAt?: unknown
            profile?: unknown
            edges?: unknown
          }
          if (!Array.isArray(a.nodes)) {
            return { ok: false, error: 'nodes must be an array', code: 'invalid_args' }
          }
          if (typeof a.scannedAt !== 'string' || Number.isNaN(Date.parse(a.scannedAt))) {
            return {
              ok: false,
              error: 'scannedAt must be an ISO date string',
              code: 'invalid_args'
            }
          }
          if (typeof a.profile !== 'string') {
            return { ok: false, error: 'profile must be a string', code: 'invalid_args' }
          }
          const edges =
            a.edges === undefined
              ? undefined
              : Array.isArray(a.edges)
                ? (a.edges as ScanFileEdge[])
                : undefined

          const file = buildScanFile({
            nodes: a.nodes as CloudNode[],
            scannedAt: a.scannedAt,
            profile: a.profile,
            edges
          })
          const defaultName = scanFileDefaultName(a.profile, a.scannedAt)
          const dlgResult = mainWindow
            ? await dialog.showSaveDialog(mainWindow, {
                defaultPath: defaultName,
                filters: [{ name: 'RiftView Scan', extensions: ['json'] }]
              })
            : await dialog.showSaveDialog({
                defaultPath: defaultName,
                filters: [{ name: 'RiftView Scan', extensions: ['json'] }]
              })

          if (dlgResult.canceled || !dlgResult.filePath) {
            return { ok: false, error: 'cancelled', code: 'cancelled' }
          }

          const text = serializeScanFile(file)
          await fsp.writeFile(dlgResult.filePath, text, 'utf-8')
          console.log('[ipc] scan:export-json ok', {
            path: dlgResult.filePath,
            nodeCount: file.nodes.length
          })
          return { ok: true, path: dlgResult.filePath }
        } catch (err) {
          const code = err instanceof ScanFileError ? err.code : (err as NodeJS.ErrnoException).code
          console.error('[ipc] scan:export-json failed', { code })
          return { ok: false, error: (err as Error).message ?? 'export failed', code }
        }
      }
    )

    ipcMain.handle(
      IPC.SCAN_IMPORT_JSON,
      async (): Promise<
        | {
            ok: true
            nodes: CloudNode[]
            edges?: ScanFileEdge[]
            scannedAt: string
            profile: string
          }
        | { ok: false; error: string; code?: string }
      > => {
        try {
          const dlgResult = mainWindow
            ? await dialog.showOpenDialog(mainWindow, {
                filters: [{ name: 'RiftView Scan', extensions: ['json'] }],
                properties: ['openFile']
              })
            : await dialog.showOpenDialog({
                filters: [{ name: 'RiftView Scan', extensions: ['json'] }],
                properties: ['openFile']
              })
          if (dlgResult.canceled || !dlgResult.filePaths[0]) {
            return { ok: false, error: 'cancelled', code: 'cancelled' }
          }
          const raw = await fsp.readFile(dlgResult.filePaths[0], 'utf-8')
          const file = parseScanFile(raw)
          console.log('[ipc] scan:import-json ok', {
            nodeCount: file.nodes.length,
            edgeCount: file.edges?.length ?? 0
          })
          return {
            ok: true,
            nodes: file.nodes,
            edges: file.edges,
            scannedAt: file.scannedAt,
            profile: file.profile
          }
        } catch (err) {
          const code = err instanceof ScanFileError ? err.code : (err as NodeJS.ErrnoException).code
          console.error('[ipc] scan:import-json failed', { code })
          return { ok: false, error: (err as Error).message ?? 'import failed', code }
        }
      }
    )
  }

  // SSM terminal — start session
  ipcMain.handle(
    IPC.TERMINAL_START,
    async (_, params: { instanceId: string; region: string; profile: AwsProfile }) => {
      try {
        const sessionId = randomUUID()
        let env: NodeJS.ProcessEnv
        if (params.profile.endpoint) {
          env = {
            ...process.env,
            AWS_ENDPOINT_URL: params.profile.endpoint,
            AWS_ACCESS_KEY_ID: 'test',
            AWS_SECRET_ACCESS_KEY: 'test',
            AWS_PROFILE: undefined,
            AWS_DEFAULT_PROFILE: undefined
          }
        } else {
          env = { ...process.env, AWS_PROFILE: params.profile.name }
        }
        const proc = spawn(
          'aws',
          ['ssm', 'start-session', '--target', params.instanceId, '--region', params.region],
          {
            env,
            stdio: 'pipe'
          }
        )
        terminalSessions.set(sessionId, proc)
        proc.stdout?.on('data', (chunk: Buffer) => {
          mainWindow?.webContents.send(IPC.TERMINAL_OUTPUT, { sessionId, data: chunk.toString() })
        })
        proc.stderr?.on('data', (chunk: Buffer) => {
          mainWindow?.webContents.send(IPC.TERMINAL_OUTPUT, { sessionId, data: chunk.toString() })
        })
        proc.on('exit', () => {
          mainWindow?.webContents.send(IPC.TERMINAL_OUTPUT, {
            sessionId,
            data: '\r\n[Session ended]\r\n'
          })
          terminalSessions.delete(sessionId)
        })
        return { ok: true as const, sessionId }
      } catch (e) {
        return { ok: false as const, error: String(e) }
      }
    }
  )

  // SSM terminal — send input
  ipcMain.handle(IPC.TERMINAL_INPUT, async (_, sessionId: string, data: string) => {
    terminalSessions.get(sessionId)?.stdin?.write(data)
  })

  // SSM terminal — resize (best-effort no-op)
  ipcMain.handle(IPC.TERMINAL_RESIZE, async () => {
    /* best-effort no-op */
  })

  // SSM terminal — close
  ipcMain.handle(IPC.TERMINAL_CLOSE, async (_, sessionId: string) => {
    const proc = terminalSessions.get(sessionId)
    if (proc) {
      proc.kill()
      terminalSessions.delete(sessionId)
    }
  })

  // Initialise engine for the default session
  cliEngine = new CliEngine(win)

  // --- RESTORE (SecOps review required per handler) ---
  // All restore handlers are structurally absent in demo mode.
  // RESTORE_PLAN / RESTORE_CONFIRM_STEP / RESTORE_APPLY are additionally absent
  // when safeStorage.isEncryptionAvailable() is false (amendment c, RIF-20 2026-04-21).
  if (!isDemoMode()) {
    const encAvailable = safeStorage.isEncryptionAvailable()

    // Read-only channels — available even when keychain is unavailable.
    ipcMain.handle(IPC.RESTORE_VERSIONS, async (_, snapshotId: unknown) => {
      if (typeof snapshotId !== 'string' || snapshotId.length === 0) return []
      try {
        return listVersionsSafe({ profile: undefined, region: undefined })
      } catch {
        return []
      }
    })

    ipcMain.handle(IPC.RESTORE_COST_ESTIMATE, async (_, planToken: unknown) => {
      if (typeof planToken !== 'string') return null
      const entry = lookupPlanToken(planToken)
      if (!entry) return null
      return computeCostDelta(entry.plan)
    })

    ipcMain.handle(IPC.RESTORE_CANCEL, async (_, applyId: unknown) => {
      if (typeof applyId !== 'string') return { ok: false }
      // Full cancellation logic is RIF-19/RIF-20's scope. Stub for interface delivery.
      return { ok: true }
    })

    if (encAvailable) {
      // Write/mutating channels — structurally absent when keychain unavailable.

      ipcMain.handle(IPC.RESTORE_PLAN, async (_, snapshotId: unknown, versionId: unknown) => {
        if (typeof snapshotId !== 'string' || typeof versionId !== 'string') {
          return { error: 'invalid arguments' }
        }
        // planRestore implementation is RIF-18 apply-side work. For now, mint a
        // stub token so the IPC surface and HMAC path are exercisable.
        const stubPlan = {
          planId: 'stub',
          pluginId: 'com.riftview.aws',
          versionFormat: 'scan-snapshot' as const,
          from: { versionId, capturedAt: '', pluginId: '', region: '', versionFormat: '' },
          to: 'live' as const,
          steps: [],
          createdAt: new Date().toISOString(),
          planToken: ''
        }
        const planToken = mintPlanToken(snapshotId, versionId, stubPlan)
        const destructiveIds: string[] = []
        const hmac = signPlanProjection(planToken, destructiveIds)
        return { planToken, signedPlanProjection: { destructiveIds, hmac }, steps: [] }
      })

      ipcMain.handle(
        IPC.RESTORE_CONFIRM_STEP,
        async (
          _,
          planToken: unknown,
          stepId: unknown,
          destructiveIds: unknown,
          hmac: unknown,
          typedString: unknown
        ) => {
          if (
            typeof planToken !== 'string' ||
            typeof stepId !== 'string' ||
            !Array.isArray(destructiveIds) ||
            typeof hmac !== 'string' ||
            typeof typedString !== 'string'
          ) {
            return { error: 'invalid arguments' }
          }
          const ids = destructiveIds as string[]
          if (!verifyPlanProjection(planToken, ids, hmac)) {
            return { error: 'hmac verification failed' }
          }
          const entry = lookupPlanToken(planToken)
          if (!entry) return { error: 'plan not found or expired' }
          // Confirmation token = HMAC of (planToken + stepId + typedString)
          const confirmationToken = signPlanProjection(planToken + stepId, [typedString])
          return { confirmationToken }
        }
      )

      ipcMain.handle(
        IPC.RESTORE_APPLY,
        async (
          _,
          planToken: unknown,
          confirmationTokens: unknown,
          destructiveIds: unknown,
          hmac: unknown
        ) => {
          if (typeof planToken !== 'string' || !Array.isArray(confirmationTokens)) {
            return { error: 'invalid arguments' }
          }
          if (!Array.isArray(destructiveIds) || typeof hmac !== 'string') {
            return { error: 'invalid arguments' }
          }
          // Amendment (a) RIF-20 2026-04-21: re-verify the signed projection so
          // the renderer cannot tamper with the destructive-ID list between
          // planRestore and apply. Same verification used in RESTORE_CONFIRM_STEP.
          if (!verifyPlanProjection(planToken, destructiveIds as string[], hmac)) {
            return { error: 'hmac verification failed' }
          }
          const entry = consumePlanToken(planToken)
          if (!entry) return { error: 'plan not found or expired' }
          // Full apply is RIF-19/RIF-20 apply-side scope. The apply loop emits
          // IPC.RESTORE_EVENT to the renderer for each step as it completes.
          const applyId = `apply-${Date.now()}`
          // emit a synthetic started event so the channel reference is wired
          mainWindow?.webContents.send(IPC.RESTORE_EVENT, {
            applyId,
            stepId: '',
            status: 'queued',
            message: 'apply queued — full implementation in RIF-20'
          })
          return { applyId }
        }
      )
    }
  }
}

async function restartScanner(
  win: BrowserWindow,
  profile: string,
  regions: string[],
  endpoint?: string
): Promise<void> {
  scanner?.stop()
  activeProfile = profile
  activeEndpoint = endpoint
  activeRegions = regions
  // Activate plugin credentials for all requested regions before starting the scanner.
  // This must run once per profile/region change — not on every scan cycle.
  await pluginRegistry.activateAll(profile, regions, endpoint)
  // Recreate engine to ensure it holds the current win reference after profile/region switch
  cliEngine = new CliEngine(win, endpoint)
  // Keep a single client set for the primary region (used by CF, etc.)
  clients = createClients(profile, regions[0] ?? 'us-east-1', endpoint)
  // Read persisted scan interval and pass it to the scanner
  const storedSettings: { scanInterval?: unknown } = (() => {
    try {
      return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8'))
    } catch {
      return {}
    }
  })()
  const rawInterval = storedSettings.scanInterval ?? DEFAULT_SETTINGS.scanInterval
  const intervalMs: number | 'manual' =
    rawInterval === 'manual' ? 'manual' : (rawInterval as number) * 1000
  scanner = new ResourceScanner(profile, regions, endpoint, win, intervalMs)
  scanner.start()
  win.webContents.send(IPC.PLUGIN_METADATA, pluginRegistry.getAllNodeTypeMetadata())
}
