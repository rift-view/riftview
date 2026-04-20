import type { CloudNode } from '@riftview/shared'

export const HISTORY_SCHEMA_VERSION = 1

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

export interface VersionRow {
  id: string
  timestamp: string
  profile: string
  region: string
  endpoint: string | null
  scanMeta: ScanMeta
  contentHash: string
}

export interface NodeRow {
  versionId: string
  nodeId: string
  nodeType: string
  label: string
  status: string
  region: string
  parentId: string | null
  shape: Record<string, unknown>
  data: Record<string, unknown>
  integrations: { targetId: string; edgeType: string }[] | null
  tfMetadata: Record<string, unknown> | null
  driftStatus: string | null
}

export interface EdgeRow {
  versionId: string
  fromId: string
  toId: string
  edgeType: string
}
