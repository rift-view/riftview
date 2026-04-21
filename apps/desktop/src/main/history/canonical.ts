import { createHash } from 'node:crypto'
import type { CloudNode } from '@riftview/shared'
import type { EdgeRecord, ScanMeta, ScanPayload } from './types'

export function canonicalize(payload: ScanPayload): string {
  return JSON.stringify({
    nodes: [...payload.nodes].sort(byNodeId).map(stableCloudNode),
    edges: [...payload.edges].sort(byEdgeKey),
    meta: stableScanMeta(payload.meta)
  })
}

export function contentHash(payload: ScanPayload): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex')
}

function byNodeId(a: CloudNode, b: CloudNode): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function byEdgeKey(a: EdgeRecord, b: EdgeRecord): number {
  const keyA = `${a.from}\x00${a.to}\x00${a.edgeType}`
  const keyB = `${b.from}\x00${b.to}\x00${b.edgeType}`
  return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
}

function stableCloudNode(node: CloudNode): Record<string, unknown> {
  const integrations = node.integrations
    ? [...node.integrations].sort((a, b) => {
        const keyA = `${a.targetId}\x00${a.edgeType}`
        const keyB = `${b.targetId}\x00${b.edgeType}`
        return keyA < keyB ? -1 : keyA > keyB ? 1 : 0
      })
    : undefined
  return stableRecord({
    id: node.id,
    type: node.type,
    label: node.label,
    status: node.status,
    region: node.region,
    metadata: stableRecord(node.metadata ?? {}),
    parentId: node.parentId,
    integrations,
    tfMetadata: node.tfMetadata ? stableRecord(node.tfMetadata) : undefined,
    driftStatus: node.driftStatus
  })
}

function stableScanMeta(meta: ScanMeta): Record<string, unknown> {
  return stableRecord({
    nodeCount: meta.nodeCount,
    edgeCount: meta.edgeCount,
    pluginId: meta.pluginId,
    pluginVersion: meta.pluginVersion,
    schemaVersion: meta.schemaVersion,
    scanErrors: meta.scanErrors
  })
}

function stableRecord(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key]
    if (v === undefined) continue
    out[key] = isPlainObject(v) ? stableRecord(v) : Array.isArray(v) ? v.map(stableValue) : v
  }
  return out
}

function stableValue(v: unknown): unknown {
  if (isPlainObject(v)) return stableRecord(v)
  if (Array.isArray(v)) return v.map(stableValue)
  return v
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}
