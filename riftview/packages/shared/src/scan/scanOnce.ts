import type { CloudNode, ScanError } from '../types/cloud'
import { markStandaloneNodes } from './markStandalone'

export interface ScanOnceResult {
  nodes: CloudNode[]
  errors: ScanError[]
  durationMs: number
}

export interface ScanOnceOptions {
  profile: string
  regions: string[]
  endpoint?: string
  /** Fan-out scanner — called once per region. Provided by the caller (desktop wires pluginRegistry). */
  scanAll: (region: string) => Promise<{ nodes: CloudNode[]; errors: ScanError[] }>
  /** Optional activation hook — called once before scanning to prime credentials / plugins. */
  activate?: (profile: string, regions: string[], endpoint?: string) => Promise<void>
}

export async function scanOnce(opts: ScanOnceOptions): Promise<ScanOnceResult> {
  const t0 = performance.now()
  if (opts.activate) {
    await opts.activate(opts.profile, opts.regions, opts.endpoint)
  }
  const regionResults = await Promise.all(opts.regions.map((r) => opts.scanAll(r)))
  const nodes = regionResults.flatMap((r) => r.nodes)
  const errors = regionResults.flatMap((r) => r.errors)
  markStandaloneNodes(nodes)
  const durationMs = performance.now() - t0
  return { nodes, errors, durationMs }
}
