import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import os from 'os'
import { ipcMain, BrowserWindow, app, dialog } from 'electron'
import { IPC } from './channels'
import { listProfiles, getDefaultRegion } from '../aws/credentials'
import { createClients } from '../aws/client'
import type { AwsClients } from '../aws/client'
import { ResourceScanner } from '../aws/scanner'
import { CliEngine } from '../cli/engine'
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

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

const DEFAULT_SETTINGS = {
  deleteConfirmStyle: 'type-to-confirm' as const,
  scanInterval: 30 as const,
  theme: 'dark' as const,
}

let scanner:   ResourceScanner | null = null
let cliEngine: CliEngine       | null = null
let clients:   AwsClients      | null = null

export function registerHandlers(win: BrowserWindow): void {
  // List available AWS profiles
  ipcMain.handle(IPC.PROFILES_LIST, () => listProfiles())

  // Select a profile — recreates clients + restarts scanner
  ipcMain.handle(IPC.PROFILE_SELECT, (_event, profile: AwsProfile) => {
    const region = getDefaultRegion(profile.name)
    restartScanner(win, profile.name, region, profile.endpoint)
  })

  // Select a region — recreates clients + restarts scanner with current profile
  ipcMain.handle(IPC.REGION_SELECT, (_event, { region, endpoint }: { region: string; endpoint?: string }) => {
    const profile = process.env.AWS_PROFILE ?? 'default'
    restartScanner(win, profile, region, endpoint)
  })

  // Manual scan trigger
  ipcMain.handle(IPC.SCAN_START, () => {
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
      const hcl = generateTerraformFile(nodes)
      const { filePath } = await dialog.showSaveDialog({
        defaultPath: 'main.tf',
        filters: [{ name: 'Terraform', extensions: ['tf'] }],
      })
      if (!filePath) return { success: false }
      await fsp.writeFile(filePath, hcl, 'utf-8')
      return { success: true }
    } catch (err) {
      console.error('TERRAFORM_EXPORT error:', err)
      return { success: false }
    }
  })

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

  // Initialise engine for the default session
  cliEngine = new CliEngine(win)
}

function restartScanner(win: BrowserWindow, profile: string, region: string, endpoint?: string): void {
  scanner?.stop()
  // Recreate engine to ensure it holds the current win reference after profile/region switch
  cliEngine = new CliEngine(win, endpoint)
  clients   = createClients(profile, region, endpoint)
  scanner   = new ResourceScanner(clients, region, win)
  scanner.start()
}
