import type { CloudNode, DriftStatus, EdgeType, NodeStatus, NodeType } from '@riftview/shared'
import type { Db, Statements } from './db'
import type { EdgeRecord, ScanMeta } from './types'

export interface VersionMeta {
  id: string
  timestamp: string
  profile: string
  region: string
  endpoint: string | null
  scanMeta: ScanMeta
  contentHash: string
}

export interface Snapshot {
  meta: VersionMeta
  nodes: CloudNode[]
  edges: EdgeRecord[]
}

export interface ListVersionsFilter {
  profile?: string
  region?: string
  limit?: number
}

const DEFAULT_LIST_LIMIT = 50

interface VersionDbRow {
  id: string
  timestamp: string
  profile: string
  region: string
  endpoint: string | null
  scan_meta_json: string
  content_hash: string
}

interface NodeDbRow {
  node_id: string
  node_type: string
  label: string
  status: string
  region: string
  parent_id: string | null
  shape_json: string
  data_json: string
  integrations_json: string | null
  tf_metadata_json: string | null
  drift_status: string | null
}

interface EdgeDbRow {
  from_id: string
  to_id: string
  edge_type: string
  edge_data_json: string | null
}

function toVersionMeta(row: VersionDbRow): VersionMeta {
  return {
    id: row.id,
    timestamp: row.timestamp,
    profile: row.profile,
    region: row.region,
    endpoint: row.endpoint,
    scanMeta: JSON.parse(row.scan_meta_json) as ScanMeta,
    contentHash: row.content_hash
  }
}

function toCloudNode(row: NodeDbRow): CloudNode {
  const shape = JSON.parse(row.shape_json) as Record<string, unknown>
  const data = JSON.parse(row.data_json) as Record<string, unknown>
  const metadata = { ...shape, ...data }

  const node: CloudNode = {
    id: row.node_id,
    type: row.node_type as NodeType,
    label: row.label,
    status: row.status as NodeStatus,
    region: row.region,
    metadata
  }
  if (row.parent_id !== null) node.parentId = row.parent_id
  if (row.integrations_json !== null) {
    node.integrations = JSON.parse(row.integrations_json) as {
      targetId: string
      edgeType: EdgeType
    }[]
  }
  if (row.tf_metadata_json !== null) {
    node.tfMetadata = JSON.parse(row.tf_metadata_json) as Record<string, unknown>
  }
  if (row.drift_status !== null) node.driftStatus = row.drift_status as DriftStatus
  return node
}

function toEdgeRecord(row: EdgeDbRow): EdgeRecord {
  return { from: row.from_id, to: row.to_id, edgeType: row.edge_type }
}

export function listVersions(
  _db: Db,
  stmts: Statements,
  filter: ListVersionsFilter = {}
): VersionMeta[] {
  const limit = filter.limit ?? DEFAULT_LIST_LIMIT
  let rows: VersionDbRow[]
  if (filter.profile && filter.region) {
    rows = stmts.listVersionsByProfileRegion.all(
      filter.profile,
      filter.region,
      limit
    ) as VersionDbRow[]
  } else if (filter.profile) {
    rows = stmts.listVersionsByProfile.all(filter.profile, limit) as VersionDbRow[]
  } else {
    rows = stmts.listVersionsAll.all(limit) as VersionDbRow[]
  }
  return rows.map(toVersionMeta)
}

export function readSnapshot(_db: Db, stmts: Statements, versionId: string): Snapshot | null {
  const versionRow = stmts.selectVersionById.get(versionId) as VersionDbRow | undefined
  if (!versionRow) return null

  const nodeRows = stmts.selectNodesByVersion.all(versionId) as NodeDbRow[]
  const edgeRows = stmts.selectEdgesByVersion.all(versionId) as EdgeDbRow[]

  return {
    meta: toVersionMeta(versionRow),
    nodes: nodeRows.map(toCloudNode),
    edges: edgeRows.map(toEdgeRecord)
  }
}

export function deleteSnapshot(_db: Db, stmts: Statements, versionId: string): { ok: boolean } {
  const info = stmts.deleteVersion.run(versionId)
  return { ok: info.changes > 0 }
}
