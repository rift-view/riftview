import path from 'node:path'
import { app } from 'electron'
import { openDb, prepareStatements, type Db, type Statements } from './db'
import {
  deleteSnapshot,
  listVersions,
  readSnapshot,
  type ListVersionsFilter,
  type Snapshot,
  type VersionMeta
} from './read'
import { writeSnapshot, type WriteSnapshotInput, type WriteSnapshotResult } from './write'

let db: Db | null = null
let stmts: Statements | null = null

export function defaultSnapshotDbPath(): string {
  return path.join(app.getPath('userData'), 'snapshots.db')
}

export function initSnapshotStore(dbPath: string): void {
  if (db) return
  db = openDb(dbPath)
  stmts = prepareStatements(db)
}

export function closeSnapshotStore(): void {
  if (!db) return
  db.close()
  db = null
  stmts = null
}

export function isSnapshotStoreOpen(): boolean {
  return db !== null && stmts !== null
}

export function writeSnapshotSafe(
  input: WriteSnapshotInput,
  retention = 50,
  clock?: () => Date
): WriteSnapshotResult | null {
  if (!ensureOpen()) return null
  if (!db || !stmts) return null
  try {
    return writeSnapshot(db, stmts, input, retention, clock ?? (() => new Date()))
  } catch (err) {
    console.error('[history] writeSnapshot failed', err)
    return null
  }
}

function ensureOpen(): boolean {
  if (db && stmts) return true
  try {
    initSnapshotStore(defaultSnapshotDbPath())
    return db !== null && stmts !== null
  } catch (err) {
    console.error('[history] failed to init snapshot store', err)
    return false
  }
}

export function validateListFilter(input: unknown): ListVersionsFilter {
  if (input === undefined || input === null) return {}
  if (typeof input !== 'object') throw new TypeError('filter must be an object')
  const { profile, region, limit } = input as Record<string, unknown>
  const out: ListVersionsFilter = {}
  if (profile !== undefined) {
    if (typeof profile !== 'string') throw new TypeError('filter.profile must be a string')
    out.profile = profile
  }
  if (region !== undefined) {
    if (typeof region !== 'string') throw new TypeError('filter.region must be a string')
    out.region = region
  }
  if (limit !== undefined) {
    if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new TypeError('filter.limit must be an integer in [1, 500]')
    }
    out.limit = limit
  }
  return out
}

function validateVersionId(input: unknown): string {
  if (typeof input !== 'string') throw new TypeError('versionId must be a string')
  if (input.length < 1 || input.length > 64) throw new TypeError('versionId out of range')
  if (!/^[A-Za-z0-9_-]+$/.test(input)) throw new TypeError('versionId contains illegal characters')
  return input
}

export function listVersionsSafe(filter?: unknown): VersionMeta[] {
  const safeFilter = validateListFilter(filter)
  if (!ensureOpen() || !db || !stmts) return []
  try {
    return listVersions(db, stmts, safeFilter)
  } catch (err) {
    console.error('[history] listVersions failed', err)
    return []
  }
}

export function readSnapshotSafe(versionId: unknown): Snapshot | null {
  const id = validateVersionId(versionId)
  if (!ensureOpen() || !db || !stmts) return null
  try {
    return readSnapshot(db, stmts, id)
  } catch (err) {
    console.error('[history] readSnapshot failed', err)
    return null
  }
}

export function deleteSnapshotSafe(versionId: unknown): { ok: boolean } {
  const id = validateVersionId(versionId)
  if (!ensureOpen() || !db || !stmts) return { ok: false }
  try {
    return deleteSnapshot(db, stmts, id)
  } catch (err) {
    console.error('[history] deleteSnapshot failed', err)
    return { ok: false }
  }
}
