/**
 * Live-scan JSON file bridge (RIFT-77).
 *
 * Lets the operator save the current in-memory scan to disk as a portable JSON
 * file and reload it later. This is intentionally distinct from RIFT-40's
 * snapshot-file bridge in `apps/desktop/src/main/history/snapshotFile.ts`:
 *
 *   - RIFT-40: exports a versioned snapshot from the SQLite history store.
 *     Shape is the CLI's `command: 'scan'` envelope so the CLI and desktop can
 *     share files. Persists into SQLite on import.
 *   - RIFT-77 (this file): exports the live current-scan state straight from
 *     the renderer. Shape is a smaller `riftview-scan` envelope with just what
 *     the renderer needs to rebuild the canvas: nodes, edges, scannedAt,
 *     profile. Does NOT touch SQLite — import returns the parsed payload to
 *     the renderer, which calls a store action to swap state.
 *
 * Both schemas tag a `version` field for forward-compat. They share `nodes`
 * shape (CloudNode[]) but use different envelope keys to keep the two paths
 * unambiguous: a snapshot file has `schemaVersion`/`command`/`timestamp`; a
 * scan file has `version`/`kind`/`scannedAt`. A user picking the wrong file
 * for the wrong import slot gets a clean "wrong kind" error, not a confusing
 * partial parse.
 *
 * No logging of scan contents in this module — caller logs `{ ok, path,
 * code }` metadata only.
 */

import type { CloudNode } from '@riftview/shared'

export const SCAN_FILE_VERSION = 1 as const

/** Edge shape kept simple — source/target plus optional label. */
export interface ScanFileEdge {
  source: string
  target: string
  label?: string
}

/**
 * Live-scan JSON envelope. Distinct from `SnapshotFileV1` (history bridge):
 * uses `version`/`kind`/`scannedAt` as discriminators so a user picking the
 * wrong file for the wrong slot fails cleanly.
 */
export interface ScanFileV1 {
  version: typeof SCAN_FILE_VERSION
  kind: 'riftview-scan'
  profile: string
  scannedAt: string
  nodes: CloudNode[]
  edges?: ScanFileEdge[]
}

export class ScanFileError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'ScanFileError'
  }
}

export interface ScanFileBuildArgs {
  nodes: CloudNode[]
  scannedAt: string
  profile: string
  edges?: ScanFileEdge[]
}

/** Build a ScanFileV1 envelope from the renderer's live-scan slot. */
export function buildScanFile(args: ScanFileBuildArgs): ScanFileV1 {
  const file: ScanFileV1 = {
    version: SCAN_FILE_VERSION,
    kind: 'riftview-scan',
    profile: args.profile,
    scannedAt: args.scannedAt,
    nodes: args.nodes
  }
  if (args.edges && args.edges.length > 0) file.edges = args.edges
  return file
}

/** Canonical on-disk form: 2-space indent, trailing newline (matches snapshotFile). */
export function serializeScanFile(file: ScanFileV1): string {
  return JSON.stringify(file, null, 2) + '\n'
}

/**
 * Parse + validate raw JSON text as a ScanFileV1. Throws `ScanFileError` on
 * any structural failure so the caller can return `{ ok: false, error }`
 * without leaking stack traces or scan contents to the renderer.
 *
 * Validation is deliberately conservative — we reject anything missing the
 * required envelope keys (`version`, `nodes`) so a malformed file can't sneak
 * through and crash the renderer once it tries to render the swap.
 */
export function parseScanFile(raw: string): ScanFileV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new ScanFileError('invalid_json', `not valid JSON: ${(err as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ScanFileError('invalid_shape', 'root is not an object')
  }
  const obj = parsed as Record<string, unknown>

  if (!('version' in obj)) {
    throw new ScanFileError('missing_version', "missing required field 'version'")
  }
  if (obj.version !== SCAN_FILE_VERSION) {
    throw new ScanFileError(
      'unsupported_version',
      `unsupported version ${String(obj.version)} (expected ${SCAN_FILE_VERSION})`
    )
  }
  // `kind` is optional for a slightly looser ingest path, but if present it
  // must match — this prevents a snapshot-file (kind: 'riftview-snapshot' /
  // command: 'scan') from being parsed as a scan-file.
  if ('kind' in obj && obj.kind !== 'riftview-scan') {
    throw new ScanFileError('wrong_kind', `expected kind 'riftview-scan', got ${String(obj.kind)}`)
  }
  if (!('nodes' in obj)) {
    throw new ScanFileError('invalid_shape', "missing required field 'nodes'")
  }
  if (!Array.isArray(obj.nodes)) {
    throw new ScanFileError('invalid_shape', 'nodes must be an array')
  }
  if (typeof obj.profile !== 'string') {
    throw new ScanFileError('invalid_shape', 'profile must be a string')
  }
  if (typeof obj.scannedAt !== 'string' || Number.isNaN(Date.parse(obj.scannedAt))) {
    throw new ScanFileError('invalid_shape', 'scannedAt must be an ISO date string')
  }

  for (const n of obj.nodes as unknown[]) {
    if (!n || typeof n !== 'object') {
      throw new ScanFileError('invalid_shape', 'nodes[] entry is not an object')
    }
    const node = n as Record<string, unknown>
    if (typeof node.id !== 'string' || typeof node.type !== 'string') {
      throw new ScanFileError('invalid_shape', 'node is missing id or type')
    }
    if (typeof node.region !== 'string') {
      throw new ScanFileError('invalid_shape', `node ${String(node.id)} is missing region`)
    }
  }

  if ('edges' in obj && obj.edges !== undefined) {
    if (!Array.isArray(obj.edges)) {
      throw new ScanFileError('invalid_shape', 'edges must be an array if present')
    }
    for (const e of obj.edges as unknown[]) {
      if (!e || typeof e !== 'object') {
        throw new ScanFileError('invalid_shape', 'edges[] entry is not an object')
      }
      const edge = e as Record<string, unknown>
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string') {
        throw new ScanFileError('invalid_shape', 'edge is missing source or target')
      }
    }
  }

  return obj as unknown as ScanFileV1
}

/** Default filename used by both export dialog + tests. */
export function scanFileDefaultName(profile: string, scannedAt: string): string {
  // Match snapshot-file timestamp-safing: replace : and . so the filename is
  // POSIX-friendly on every OS we ship on.
  const safeStamp = scannedAt.replace(/[:.]/g, '-')
  return `riftview-scan-${profile}-${safeStamp}.json`
}
