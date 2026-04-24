/**
 * CLI ↔ desktop snapshot-file interop (RIFT-40).
 *
 * The desktop stores snapshots in SQLite (per RIFT-5). The CLI writes them as
 * plain JSON files (`apps/cli/cli/snapshot.ts`). This module is the bridge —
 * it marshals between the two without introducing a cross-workspace
 * dependency (desktop must not import @riftview/cli).
 *
 * The on-disk shape matches the CLI's v1 schema so a file produced by either
 * side is readable by the other. Serialization is deterministic (2-space
 * indent, trailing newline) to match `apps/cli/cli/output/json.ts` — this is
 * what keeps the round-trip byte-stable.
 *
 * We intentionally do NOT log snapshot contents anywhere in this module; the
 * caller only logs `{ ok, path, versionId, error?.code }` style metadata.
 */

import type { CloudNode, EdgeType } from '@riftview/shared'
import type { Snapshot } from './read'

export const SNAPSHOT_FILE_SCHEMA_VERSION = 1 as const

/** Edge shape in the CLI's on-disk JSON — `source`/`target`, not `from`/`to`. */
export interface OnDiskEdge {
  source: string
  target: string
  edgeType: EdgeType
}

/**
 * Single-version JSON envelope. Flat `ScanOutput`-like shape mirroring
 * `apps/cli/cli/output/schema.ts`. Kept here (not imported from the CLI) so
 * the dependency direction is desktop → shared only — the CLI and desktop
 * share a schema version, not a codebase.
 */
export interface SnapshotFileV1 {
  schemaVersion: typeof SNAPSHOT_FILE_SCHEMA_VERSION
  command: 'scan'
  profile: string
  regions: string[]
  endpoint?: string
  timestamp: string
  durationMs: number
  nodes: CloudNode[]
  edges: OnDiskEdge[]
  scanErrors: Array<{ service?: string; region?: string; message: string }>
  topRisks: unknown[]
}

/**
 * Serialize a SQLite-backed Snapshot into the CLI's on-disk JSON shape.
 *
 * Fields that don't exist in the desktop record are given deterministic
 * defaults:
 *   - `durationMs`: 0  (desktop doesn't track wall time per snapshot)
 *   - `topRisks`:   [] (advisories are computed at render time, not stored)
 *   - `scanErrors`: flattened from the desktop's string[] form to objects
 *     (the file shape uses objects; we project "unknown:unknown:<msg>" back)
 */
export function snapshotToFile(snap: Snapshot): SnapshotFileV1 {
  const edges: OnDiskEdge[] = snap.edges.map((e) => ({
    source: e.from,
    target: e.to,
    edgeType: e.edgeType as EdgeType
  }))

  const file: SnapshotFileV1 = {
    schemaVersion: SNAPSHOT_FILE_SCHEMA_VERSION,
    command: 'scan',
    profile: snap.meta.profile,
    regions: [snap.meta.region],
    timestamp: snap.meta.timestamp,
    durationMs: 0,
    nodes: snap.nodes,
    edges,
    scanErrors: (snap.meta.scanMeta.scanErrors ?? []).map(parseErrorString),
    topRisks: []
  }
  if (snap.meta.endpoint) file.endpoint = snap.meta.endpoint
  return file
}

/**
 * Parse + validate raw JSON text as a SnapshotFileV1. Throws a typed
 * `SnapshotFileError` on any structural failure so the caller can return
 * `{ ok: false, error: { code, message } }` without leaking stack traces or
 * snapshot contents to the renderer.
 */
export function parseSnapshotFile(raw: string): SnapshotFileV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new SnapshotFileError('invalid_json', `not valid JSON: ${(err as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new SnapshotFileError('invalid_shape', 'root is not an object')
  }
  const obj = parsed as Record<string, unknown>

  if (obj.schemaVersion !== SNAPSHOT_FILE_SCHEMA_VERSION) {
    throw new SnapshotFileError(
      'unsupported_schema',
      `unsupported schemaVersion ${String(obj.schemaVersion)} (expected ${SNAPSHOT_FILE_SCHEMA_VERSION})`
    )
  }
  if (obj.command !== 'scan') {
    throw new SnapshotFileError(
      'unsupported_command',
      `command must be 'scan', got ${String(obj.command)}`
    )
  }
  if (typeof obj.profile !== 'string') {
    throw new SnapshotFileError('invalid_shape', 'profile must be a string')
  }
  if (!Array.isArray(obj.regions) || obj.regions.some((r) => typeof r !== 'string')) {
    throw new SnapshotFileError('invalid_shape', 'regions must be a string[]')
  }
  if (typeof obj.timestamp !== 'string' || Number.isNaN(Date.parse(obj.timestamp))) {
    throw new SnapshotFileError('invalid_shape', 'timestamp must be an ISO date string')
  }
  if (!Array.isArray(obj.nodes)) {
    throw new SnapshotFileError('invalid_shape', 'nodes must be an array')
  }
  if (!Array.isArray(obj.edges)) {
    throw new SnapshotFileError('invalid_shape', 'edges must be an array')
  }

  // Light structural checks on each node — we don't deep-validate every AWS
  // field (the CLI already did when it emitted the file), we just make sure
  // downstream consumers won't crash on a missing id/type.
  for (const n of obj.nodes as unknown[]) {
    if (!n || typeof n !== 'object') {
      throw new SnapshotFileError('invalid_shape', 'nodes[] entry is not an object')
    }
    const node = n as Record<string, unknown>
    if (typeof node.id !== 'string' || typeof node.type !== 'string') {
      throw new SnapshotFileError('invalid_shape', 'node is missing id or type')
    }
    if (typeof node.region !== 'string') {
      throw new SnapshotFileError('invalid_shape', `node ${String(node.id)} is missing region`)
    }
  }

  for (const e of obj.edges as unknown[]) {
    if (!e || typeof e !== 'object') {
      throw new SnapshotFileError('invalid_shape', 'edges[] entry is not an object')
    }
    const edge = e as Record<string, unknown>
    if (
      typeof edge.source !== 'string' ||
      typeof edge.target !== 'string' ||
      typeof edge.edgeType !== 'string'
    ) {
      throw new SnapshotFileError('invalid_shape', 'edge is missing source, target, or edgeType')
    }
  }

  return obj as unknown as SnapshotFileV1
}

/**
 * Serialize a SnapshotFileV1 to the canonical on-disk string form.
 * Matches `apps/cli/cli/output/json.ts` + `writeSnapshot()` — 2-space indent,
 * trailing newline. Keep these byte-identical or the round-trip test breaks.
 */
export function serializeSnapshotFile(file: SnapshotFileV1): string {
  return JSON.stringify(file, null, 2) + '\n'
}

/** Projection used for the accountId-mismatch warning banner. */
export function snapshotFileIdentity(file: SnapshotFileV1): {
  profile: string
  region: string
  endpoint: string | null
} {
  return {
    profile: file.profile,
    region: file.regions[0] ?? '',
    endpoint: file.endpoint ?? null
  }
}

/** Reverse of the flattened scanError format used by the desktop store. */
function parseErrorString(s: string): { service?: string; region?: string; message: string } {
  // Format emitted by scanner.ts: "${service}/${region}: ${message}" OR
  //                              "${service}:${region}:${message}" (toScanPayload).
  // We accept both by splitting on the first two separators.
  const slashMatch = /^([^/]+)\/([^:]+):\s*(.*)$/.exec(s)
  if (slashMatch) return { service: slashMatch[1], region: slashMatch[2], message: slashMatch[3] }
  const colonMatch = /^([^:]+):([^:]+):(.*)$/.exec(s)
  if (colonMatch) return { service: colonMatch[1], region: colonMatch[2], message: colonMatch[3] }
  return { message: s }
}

export class SnapshotFileError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'SnapshotFileError'
  }
}

/** Extract the nodes array from a SnapshotFileV1 as desktop CloudNode[]. */
export function fileToCloudNodes(file: SnapshotFileV1): CloudNode[] {
  return file.nodes as CloudNode[]
}
