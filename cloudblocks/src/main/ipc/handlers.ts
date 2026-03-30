import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import { ipcMain, BrowserWindow, app, dialog, Notification } from 'electron'
import { IPC } from './channels'
import { listProfiles, getDefaultRegion } from '../aws/credentials'
import { createClients } from '../aws/client'
import type { AwsClients } from '../aws/client'
import { ResourceScanner } from '../aws/scanner'
import { CliEngine } from '../cli/engine'
import { pluginRegistry } from '../plugin/index'
import {
  CreateDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  DeleteDistributionCommand,
  GetDistributionCommand,
  CreateInvalidationCommand,
} from '@aws-sdk/client-cloudfront'
import type { CloudFrontParams } from '../../renderer/types/create'
import type { CloudFrontEditParams } from '../../renderer/types/edit'
import type { AwsProfile, CloudNode } from '../../renderer/types/cloud'
import { generateTerraformFile } from '../terraform/index'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { buildLocalStackProvider } from '../terraform/provider'
const execFileAsync = promisify(execFile)
import { parseTfState } from '../aws/tfstate/parser'
import { fetchEc2IamData, fetchLambdaIamData, fetchS3IamData } from '../aws/iam/fetcher'
import type { IamAnalysisResult } from '../../renderer/types/iam'
import type { NodeType } from '../../renderer/types/cloud'

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
  notifyOnDrift: true,
}

let scanner:        ResourceScanner | null = null
let cliEngine:      CliEngine       | null = null
let clients:        AwsClients      | null = null
let activeProfile:  string = 'default'
let activeEndpoint: string | undefined

export function registerHandlers(win: BrowserWindow): void {
  // List available AWS profiles
  ipcMain.handle(IPC.PROFILES_LIST, () => listProfiles())

  // Select a profile — recreates clients + restarts scanner
  ipcMain.handle(IPC.PROFILE_SELECT, async (_event, profile: AwsProfile) => {
    const region = getDefaultRegion(profile.name)
    await restartScanner(win, profile.name, [region], profile.endpoint)
  })

  // Select a region — recreates clients + restarts scanner with current profile
  ipcMain.handle(IPC.REGION_SELECT, async (_event, { region, endpoint }: { region: string; endpoint?: string }) => {
    const profile = process.env.AWS_PROFILE ?? 'default'
    await restartScanner(win, profile, [region], endpoint)
  })

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

  ipcMain.handle(IPC.THEME_OVERRIDES, () => {
    const file = path.join(app.getPath('userData'), 'theme.json')
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
        Id:         o.id,
        DomainName: o.domainName,
        S3OriginConfig: { OriginAccessIdentity: '' },
      }))
      const viewerCertificate = params.certArn
        ? { ACMCertificateArn: params.certArn, SSLSupportMethod: 'sni-only' as const, MinimumProtocolVersion: 'TLSv1.2_2021' as const }
        : { CloudFrontDefaultCertificate: true }

      await clients.cloudfront.send(new CreateDistributionCommand({
        DistributionConfig: {
          CallerReference:   Date.now().toString(),
          Comment:           params.comment,
          DefaultRootObject: params.defaultRootObject,
          PriceClass:        params.priceClass as import('@aws-sdk/client-cloudfront').PriceClass,
          Enabled:           true,
          Origins: { Quantity: origins.length, Items: origins },
          DefaultCacheBehavior: {
            TargetOriginId:       params.origins[0]?.id ?? 'default',
            ViewerProtocolPolicy: 'redirect-to-https',
            CachePolicyId:        '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized managed policy
            AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
          },
          ViewerCertificate: viewerCertificate,
        },
      }))
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
      const config    = configRes.DistributionConfig
      const etag      = configRes.ETag
      if (!config || !etag) return { code: 1, error: 'Could not fetch distribution config' }

      if (params.comment           !== undefined) config.Comment           = params.comment
      if (params.defaultRootObject !== undefined) config.DefaultRootObject = params.defaultRootObject
      if (params.priceClass        !== undefined) config.PriceClass        = params.priceClass as import('@aws-sdk/client-cloudfront').PriceClass
      if (params.certArn !== undefined) {
        config.ViewerCertificate = params.certArn
          ? { ACMCertificateArn: params.certArn, SSLSupportMethod: 'sni-only', MinimumProtocolVersion: 'TLSv1.2_2021' }
          : { CloudFrontDefaultCertificate: true }
      }

      await clients.cloudfront.send(new UpdateDistributionCommand({
        Id: id,
        IfMatch: etag,
        DistributionConfig: config,
      }))
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
      const config    = configRes.DistributionConfig
      let   etag      = configRes.ETag
      if (!config || !etag) return { code: 1, error: 'Could not fetch distribution config' }

      // If enabled, disable first
      if (config.Enabled) {
        config.Enabled = false
        const updateRes = await clients.cloudfront.send(new UpdateDistributionCommand({
          Id: id,
          IfMatch: etag,
          DistributionConfig: config,
        }))
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
      await clients.cloudfront.send(new CreateInvalidationCommand({
        DistributionId: id,
        InvalidationBatch: {
          Paths: { Quantity: 1, Items: [cfPath] },
          CallerReference: Date.now().toString(),
        },
      }))
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
        defaultPath: 'cloudblocks-export.png',
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      })
      if (!filePath) return { success: false }
      fs.writeFileSync(filePath, image.toPNG())
      return { success: true, filePath }
    } catch (err) {
      console.error('CANVAS_EXPORT_PNG error:', err)
      return { success: false }
    }
  })

  // Terraform HCL export — generate file and open native save dialog
  ipcMain.handle(IPC.TERRAFORM_EXPORT, async (_e, nodes: CloudNode[]) => {
    try {
      const { hcl, skippedTypes } = generateTerraformFile(nodes)
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: 'main.tf',
        filters: [{ name: 'Terraform', extensions: ['tf'] }],
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
  ipcMain.handle(IPC.TERRAFORM_DEPLOY, async (_, hcl: string, region: string, endpoint = 'http://localhost:4566'): Promise<TerraformDeployResult> => {
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
    await fsp.writeFile(configPath, buildLocalStackProvider(region, endpoint) + '\n' + hcl, 'utf-8')

    const baseOpts = { cwd: deployDir, maxBuffer: 10 * 1024 * 1024 }
    let output = ''

    try {
      // 3. terraform init
      const initResult = await execFileAsync('terraform', [
        'init', '-input=false', '-no-color',
      ], { ...baseOpts, timeout: 3 * 60 * 1000 })
      output += initResult.stdout + initResult.stderr

      // 4. terraform apply
      const applyResult = await execFileAsync('terraform', [
        'apply', '-auto-approve', '-no-color',
      ], { ...baseOpts, timeout: 5 * 60 * 1000 })
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
  })

  // Annotations — persist to userData/annotations.json
  ipcMain.handle(IPC.ANNOTATIONS_LOAD, (): Record<string, string> => {
    const file = path.join(app.getPath('userData'), 'annotations.json')
    if (!fs.existsSync(file)) return {}
    try { return JSON.parse(fs.readFileSync(file, 'utf-8')) } catch { return {} }
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
      properties: ['openFile'],
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
      { nodeId, nodeType, metadata }: { nodeId: string; nodeType: NodeType; metadata: Record<string, unknown> }
    ): Promise<IamAnalysisResult> => {
      if (!clients) {
        return { nodeId, findings: [], error: 'No AWS client — connect first', fetchedAt: Date.now() }
      }

      const node = { id: nodeId, type: nodeType, metadata } as import('../../renderer/types/cloud').CloudNode

      const timeoutPromise = new Promise<IamAnalysisResult>((resolve) =>
        setTimeout(
          () => resolve({ nodeId, findings: [], error: 'IAM analysis timed out after 10s', fetchedAt: Date.now() }),
          10_000
        )
      )

      const analyzePromise = (async (): Promise<IamAnalysisResult> => {
        try {
          let findings
          if (nodeType === 'ec2') findings = await fetchEc2IamData(node, clients!)
          else if (nodeType === 'lambda') findings = await fetchLambdaIamData(node, clients!)
          else if (nodeType === 's3') findings = await fetchS3IamData(node, clients!)
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
        title: 'Cloudblocks — Drift Detected',
        body:  `${count} resource${count === 1 ? '' : 's'} drifted from Terraform state`,
      }).show()
    }
  })

  // Initialise engine for the default session
  cliEngine = new CliEngine(win)
}

async function restartScanner(win: BrowserWindow, profile: string, regions: string[], endpoint?: string): Promise<void> {
  scanner?.stop()
  activeProfile  = profile
  activeEndpoint = endpoint
  // Activate plugin credentials for all requested regions before starting the scanner.
  // This must run once per profile/region change — not on every scan cycle.
  await pluginRegistry.activateAll(profile, regions, endpoint)
  // Recreate engine to ensure it holds the current win reference after profile/region switch
  cliEngine = new CliEngine(win, endpoint)
  // Keep a single client set for the primary region (used by CF, etc.)
  clients   = createClients(profile, regions[0] ?? 'us-east-1', endpoint)
  // Read persisted scan interval and pass it to the scanner
  const storedSettings: { scanInterval?: unknown } = (() => {
    try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) } catch { return {} }
  })()
  const rawInterval = storedSettings.scanInterval ?? DEFAULT_SETTINGS.scanInterval
  const intervalMs: number | 'manual' = rawInterval === 'manual' ? 'manual' : (rawInterval as number) * 1000
  scanner   = new ResourceScanner(profile, regions, endpoint, win, intervalMs)
  scanner.start()
  win.webContents.send(IPC.PLUGIN_METADATA, pluginRegistry.getAllNodeTypeMetadata())
}
