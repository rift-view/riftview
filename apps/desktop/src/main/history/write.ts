import { randomBytes } from 'node:crypto'
import type { CloudNode } from '@riftview/shared'
import { contentHash } from './canonical'
import { withTransaction, type Db, type Statements } from './db'
import { toSnapshotRecord } from './transform'
import { HISTORY_SCHEMA_VERSION, type EdgeRecord, type ScanMeta, type ScanPayload } from './types'

export interface WriteSnapshotInput {
  profile: string
  endpoint: string | null
  regions: string[]
  pluginId: string
  pluginVersion: string
  scanErrors: string[]
  nodes: CloudNode[]
}

export interface WriteSnapshotResult {
  versionIds: string[]
}

export function deriveEdges(nodes: CloudNode[]): EdgeRecord[] {
  const edges: EdgeRecord[] = []
  for (const node of nodes) {
    if (!node.integrations) continue
    for (const { targetId, edgeType } of node.integrations) {
      edges.push({ from: node.id, to: targetId, edgeType })
    }
  }
  return edges
}

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function ulid(now: Date): string {
  let t = now.getTime()
  let ts = ''
  for (let i = 0; i < 10; i++) {
    ts = ULID_ALPHABET[t % 32] + ts
    t = Math.floor(t / 32)
  }
  const bytes = randomBytes(10)
  let rand = ''
  for (let i = 0; i < 16; i++) {
    rand += ULID_ALPHABET[bytes[i % bytes.length] % 32]
  }
  return ts + rand
}

export function writeSnapshot(
  db: Db,
  stmts: Statements,
  input: WriteSnapshotInput,
  retention = 50,
  clock: () => Date = () => new Date()
): WriteSnapshotResult {
  const now = clock()
  const timestamp = now.toISOString()

  const nodesByRegion = new Map<string, CloudNode[]>()
  for (const r of input.regions) nodesByRegion.set(r, [])
  for (const node of input.nodes) {
    const bucket = nodesByRegion.get(node.region) ?? []
    bucket.push(node)
    nodesByRegion.set(node.region, bucket)
  }

  const allEdges = deriveEdges(input.nodes)
  const regionByNodeId = new Map(input.nodes.map((n) => [n.id, n.region]))
  const fallbackRegion = input.regions[0] ?? 'unknown'
  const edgesByRegion = new Map<string, EdgeRecord[]>()
  for (const edge of allEdges) {
    const r = regionByNodeId.get(edge.from) ?? fallbackRegion
    const bucket = edgesByRegion.get(r) ?? []
    bucket.push(edge)
    edgesByRegion.set(r, bucket)
  }

  const versionIds: string[] = []

  withTransaction(db, () => {
    const regions = [...nodesByRegion.keys()].sort()
    for (const region of regions) {
      const regionNodes = nodesByRegion.get(region) ?? []
      const regionEdges = edgesByRegion.get(region) ?? []

      const scanMeta: ScanMeta = {
        scanErrors: input.scanErrors,
        nodeCount: regionNodes.length,
        edgeCount: regionEdges.length,
        pluginId: input.pluginId,
        pluginVersion: input.pluginVersion,
        schemaVersion: HISTORY_SCHEMA_VERSION
      }

      const payload: ScanPayload = {
        nodes: regionNodes,
        edges: regionEdges,
        meta: scanMeta
      }
      const hash = contentHash(payload)
      const id = ulid(now)

      stmts.insertVersion.run(
        id,
        timestamp,
        input.profile,
        region,
        input.endpoint,
        JSON.stringify(scanMeta),
        hash
      )

      for (const node of regionNodes) {
        const { shape, data } = toSnapshotRecord(node)
        stmts.insertNode.run(
          id,
          node.id,
          node.type,
          node.label,
          node.status,
          node.region,
          node.parentId ?? null,
          JSON.stringify(shape),
          JSON.stringify(data),
          node.integrations ? JSON.stringify(node.integrations) : null,
          node.tfMetadata ? JSON.stringify(node.tfMetadata) : null,
          node.driftStatus ?? null
        )
      }

      for (const edge of regionEdges) {
        stmts.insertEdge.run(id, edge.from, edge.to, edge.edgeType, null)
      }

      versionIds.push(id)
    }

    stmts.pruneVersions.run(retention)
  })

  return { versionIds }
}
