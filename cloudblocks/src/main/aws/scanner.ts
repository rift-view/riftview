import { BrowserWindow } from 'electron'
import { IPC } from '../ipc/channels'
import type { AwsClients } from './client'
import type { CloudNode, ScanDelta } from '../../renderer/types/cloud'
import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups, describeKeyPairs } from './services/ec2'
import { describeDBInstances } from './services/rds'
import { listBuckets } from './services/s3'
import { listFunctions } from './services/lambda'
import { describeLoadBalancers } from './services/alb'

const POLL_INTERVAL_MS = 30_000

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
      if (p.status !== node.status || p.label !== node.label) {
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

  constructor(
    private clients: AwsClients,
    private region: string,
    private window: BrowserWindow,
  ) {}

  start(): void {
    this.scan()
    this.timer = setInterval(() => this.scan(), POLL_INTERVAL_MS)
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

  private async scan(): Promise<void> {
    this.window.webContents.send(IPC.SCAN_STATUS, 'scanning')

    try {
      const [instances, vpcs, subnets, sgs, dbs, buckets, fns, lbs] = await Promise.all([
        describeInstances(this.clients.ec2, this.region),
        describeVpcs(this.clients.ec2, this.region),
        describeSubnets(this.clients.ec2, this.region),
        describeSecurityGroups(this.clients.ec2, this.region),
        describeDBInstances(this.clients.rds, this.region),
        listBuckets(this.clients.s3, this.region),
        listFunctions(this.clients.lambda, this.region),
        describeLoadBalancers(this.clients.alb, this.region),
      ])

      const nextNodes = [...instances, ...vpcs, ...subnets, ...sgs, ...dbs, ...buckets, ...fns, ...lbs]
      const delta = computeDelta(this.currentNodes, nextNodes)

      this.currentNodes = nextNodes
      this.window.webContents.send(IPC.SCAN_DELTA, delta)
      this.window.webContents.send(IPC.SCAN_STATUS, 'idle')

      // Also scan key pairs and broadcast to renderer
      const keyPairs = await describeKeyPairs(this.clients.ec2)
      this.window.webContents.send(IPC.SCAN_KEYPAIRS, keyPairs)

      // Signal successful connection on the first scan that completes
      this.window.webContents.send(IPC.CONN_STATUS, 'connected')
    } catch (err) {
      this.window.webContents.send(IPC.SCAN_STATUS, 'error')
      this.window.webContents.send(IPC.CONN_STATUS, 'error')
    }
  }
}
