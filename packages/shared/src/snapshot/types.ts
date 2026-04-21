import type { CloudNode } from '../types/cloud'

export interface ScanMeta {
  scanErrors: string[]
  nodeCount: number
  edgeCount: number
  pluginId: string
  pluginVersion: string
  schemaVersion: number
}

export interface EdgeRecord {
  from: string
  to: string
  edgeType: string
}

export interface ScanPayload {
  nodes: CloudNode[]
  edges: EdgeRecord[]
  meta: ScanMeta
}
