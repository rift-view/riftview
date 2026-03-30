import { BrowserWindow } from 'electron'
import { IPC } from '../ipc/channels'
import { createClients } from './client'
import type { CloudNode, ScanDelta } from '../../renderer/types/cloud'
import { describeKeyPairs } from './services/ec2'
import { pluginRegistry } from '../plugin/index'

// pluginRegistry.activateAll() must be called before starting the scanner.
// scanner.ts never calls activateAll — it only calls scanAll() per region.

const DEFAULT_POLL_INTERVAL_MS = 30_000

// Computes the diff between previous and next resource snapshots.
// Exported for unit testing — scanner.ts is the only caller in production.
export function computeDelta(prev: CloudNode[], next: CloudNode[]): ScanDelta {
  const prevMap = new Map(prev.map((n) => [n.id, n]))
  const nextMap = new Map(next.map((n) => [n.id, n]))

  const added:   CloudNode[] = []
  const changed: CloudNode[] = []
  const removed: string[]    = []

  for (const [id, node] of nextMap) {
    if (!prevMap.has(id)) {
      added.push(node)
    } else {
      const p = prevMap.get(id)!
      if (
        p.status !== node.status ||
        p.label  !== node.label  ||
        // NOTE: JSON.stringify is key-order-sensitive; service functions must
        // return stable object literals (not spread/merge) to avoid false positives.
        JSON.stringify(p.metadata) !== JSON.stringify(node.metadata)
      ) {
        changed.push(node)
      }
    }
  }

  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) removed.push(id)
  }

  return { added, changed, removed }
}

export class ResourceScanner {
  private timer: NodeJS.Timeout | null = null
  private currentNodes: CloudNode[] = []
  private intervalMs: number | 'manual'

  constructor(
    private profile: string,
    private regions: string[],
    private endpoint: string | undefined,
    private window: BrowserWindow,
    intervalMs: number | 'manual' = DEFAULT_POLL_INTERVAL_MS,
  ) {
    this.intervalMs = intervalMs
  }

  start(): void {
    this.scan()
    if (this.intervalMs !== 'manual') {
      this.timer = setInterval(() => this.scan(), this.intervalMs)
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  triggerManualScan(): void {
    this.scan()
  }

  updateRegions(regions: string[]): void {
    this.regions = regions
  }

  updateInterval(intervalMs: number | 'manual'): void {
    this.intervalMs = intervalMs
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (intervalMs !== 'manual') {
      this.timer = setInterval(() => this.scan(), intervalMs)
    }
  }

  private async scan(): Promise<void> {
    this.window.webContents.send(IPC.SCAN_STATUS, 'scanning')

    try {
      // Fan out across all selected regions in parallel.
      // Credentials were established by activateAll() before the scanner started.
      const regionResults = await Promise.all(
        this.regions.map((region) => pluginRegistry.scanAll(region)),
      )

      const nextNodes  = regionResults.flatMap((r) => r.nodes)
      const scanErrors = regionResults.flatMap((r) => r.errors)

      const delta = computeDelta(this.currentNodes, nextNodes)

      this.currentNodes = nextNodes
      this.window.webContents.send(IPC.SCAN_DELTA, { ...delta, scanErrors })
      this.window.webContents.send(IPC.SCAN_STATUS, 'idle')

      // Key pairs are AWS-specific and consumed by the renderer's create-node
      // flow (not part of the topology graph), so they live outside awsProvider.
      // Use the first region's clients for key-pair lookup (key pairs are global per account).
      // TODO(M6): if ResourceScanner becomes provider-agnostic, move this into
      //           a provider-level `scanExtras()` hook or guard with provider.id.
      const primaryClients = createClients(this.profile, this.regions[0], this.endpoint)
      const keyPairs = await describeKeyPairs(primaryClients.ec2)
      this.window.webContents.send(IPC.SCAN_KEYPAIRS, keyPairs)

      // Signal successful connection on the first scan that completes
      this.window.webContents.send(IPC.CONN_STATUS, 'connected')
    } catch {
      this.window.webContents.send(IPC.SCAN_STATUS, 'error')
      this.window.webContents.send(IPC.CONN_STATUS, 'error')
    }
  }
}
