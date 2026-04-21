import type { ScanMeta } from '@riftview/shared/snapshot'

export { type EdgeRecord, type ScanMeta, type ScanPayload } from '@riftview/shared/snapshot'

export const HISTORY_SCHEMA_VERSION = 1

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
