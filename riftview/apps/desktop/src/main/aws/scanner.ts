import { BrowserWindow, app } from 'electron'
import fsp from 'fs/promises'
import path from 'path'
import { IPC } from '../ipc/channels'
import { createClients } from './client'
import type { CloudNode, ScanDelta } from '@riftview/shared'
import { classifyScanError, markStandaloneNodes, scanOnce } from '@riftview/shared'
import { describeKeyPairs } from './services/ec2'
import { pluginRegistry } from '../plugin/index'

// --- Per-node change history ---
interface FieldChange {
  field: string
  before: string
  after: string
}
interface HistoryEntry {
  timestamp: string
  changes: FieldChange[]
}

export function historyFilePath(nodeId: string): string {
  return path.join(
    app.getPath('userData'),
    'history',
    `${nodeId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
  )
}

async function appendHistory(nodeId: string, entry: HistoryEntry): Promise<void> {
  const p = historyFilePath(nodeId)
  await fsp.mkdir(path.dirname(p), { recursive: true })
  let entries: HistoryEntry[] = []
  try {
    entries = JSON.parse(await fsp.readFile(p, 'utf8'))
  } catch {
    /* new file */
  }
  entries.unshift(entry)
  if (entries.length > 50) entries = entries.slice(0, 50)
  await fsp.writeFile(p, JSON.stringify(entries, null, 2))
}

const nodeCache = new Map<string, CloudNode>()

// pluginRegistry.activateAll() must be called before starting the scanner.
// scanner.ts never calls activateAll — it only calls scanAll() per region.

const DEFAULT_POLL_INTERVAL_MS = 30_000

// Computes the diff between previous and next resource snapshots.
// Exported for unit testing — scanner.ts is the only caller in production.
export function computeDelta(prev: CloudNode[], next: CloudNode[]): ScanDelta {
  const prevMap = new Map(prev.map((n) => [n.id, n]))
  const nextMap = new Map(next.map((n) => [n.id, n]))

  const added: CloudNode[] = []
  const changed: CloudNode[] = []
  const removed: string[] = []

  for (const [id, node] of nextMap) {
    if (!prevMap.has(id)) {
      added.push(node)
    } else {
      const p = prevMap.get(id)!
      if (
        p.status !== node.status ||
        p.label !== node.label ||
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
  currentScanErrors: Array<{ service: string; region: string; message: string }> = []

  constructor(
    private profile: string,
    private regions: string[],
    private endpoint: string | undefined,
    private window: BrowserWindow,
    intervalMs: number | 'manual' = DEFAULT_POLL_INTERVAL_MS
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

  /**
   * Re-scan a single service, update currentNodes for those nodes only, and
   * push a scoped SCAN_DELTA to the renderer.
   *
   * @param freshNodes  Nodes returned by the per-service scan
   * @param serviceErrors  Errors from the per-service scan (empty on success)
   * @param existingScanErrors  Current full scanErrors list from the last full scan
   * @param serviceName  The service key being retried (used to drop/keep its error entry)
   */
  applyServiceRetry(
    freshNodes: import('@riftview/shared').CloudNode[],
    serviceErrors: Array<{ service: string; region: string; message: string }>,
    existingScanErrors: Array<{ service: string; region: string; message: string }>,
    serviceName: string
  ): void {
    // Compute which node IDs previously came from this service by intersecting
    // currentNodes with the IDs returned by the fresh scan plus any IDs that
    // are now absent (removed).  Since we have no per-service node-type mapping
    // here, we treat all fresh node IDs as the definitive set for this service
    // and compute the delta against currentNodes for those IDs only.
    const freshMap = new Map(freshNodes.map((n) => [n.id, n]))
    const prevServiceNodes = this.currentNodes.filter((n) => freshMap.has(n.id))

    const delta = computeDelta(prevServiceNodes, freshNodes)

    // Merge fresh nodes into currentNodes
    const currentMap = new Map(this.currentNodes.map((n) => [n.id, n]))
    for (const n of freshNodes) currentMap.set(n.id, n)
    for (const id of delta.removed) currentMap.delete(id)
    this.currentNodes = Array.from(currentMap.values())
    markStandaloneNodes(this.currentNodes)

    // Build updated error list: remove stale entry for this service, add new ones
    const updatedErrors = [
      ...existingScanErrors.filter((e) => e.service !== serviceName),
      ...serviceErrors
    ]

    this.currentScanErrors = updatedErrors
    this.window.webContents.send(IPC.SCAN_DELTA, { ...delta, scanErrors: updatedErrors })
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
      // Credentials were established by activateAll() before the scanner started.
      // scanOnce handles region fan-out + markStandaloneNodes + timing.
      const { nodes: nextNodes, errors: scanErrors } = await scanOnce({
        profile: this.profile,
        regions: this.regions,
        endpoint: this.endpoint,
        scanAll: (region) => pluginRegistry.scanAll(region)
      })

      const delta = computeDelta(this.currentNodes, nextNodes)

      this.currentNodes = nextNodes
      this.currentScanErrors = scanErrors
      this.window.webContents.send(IPC.SCAN_DELTA, { ...delta, scanErrors })

      // Record history for changed nodes
      for (const newNode of delta.changed ?? []) {
        const prev = nodeCache.get(newNode.id)
        if (!prev) {
          nodeCache.set(newNode.id, newNode)
          continue
        }
        const changes: FieldChange[] = []
        if (prev.status !== newNode.status)
          changes.push({
            field: 'status',
            before: String(prev.status ?? ''),
            after: String(newNode.status ?? '')
          })
        if (prev.label !== newNode.label)
          changes.push({ field: 'label', before: prev.label, after: newNode.label })
        const allKeys = new Set([
          ...Object.keys(prev.metadata ?? {}),
          ...Object.keys(newNode.metadata ?? {})
        ])
        for (const key of allKeys) {
          const b = JSON.stringify((prev.metadata ?? {})[key] ?? null)
          const a = JSON.stringify((newNode.metadata ?? {})[key] ?? null)
          if (b !== a) changes.push({ field: key, before: b, after: a })
        }
        if (changes.length > 0) {
          appendHistory(newNode.id, { timestamp: new Date().toISOString(), changes }).catch(
            () => {}
          )
        }
        nodeCache.set(newNode.id, newNode)
      }
      // Cache newly added nodes
      for (const n of delta.added ?? []) nodeCache.set(n.id, n)

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
    } catch (err) {
      const detail = classifyScanError(err)
      this.window.webContents.send(IPC.SCAN_STATUS, 'error')
      this.window.webContents.send(IPC.CONN_STATUS, 'error')
      this.window.webContents.send(IPC.SCAN_ERROR_DETAIL, detail)
    }
  }
}
