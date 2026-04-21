import path from 'node:path'
import { app } from 'electron'
import { openDb, prepareStatements, type Db, type Statements } from './db'
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
  retention = 50
): WriteSnapshotResult | null {
  if (!db || !stmts) {
    try {
      initSnapshotStore(defaultSnapshotDbPath())
    } catch (err) {
      console.error('[history] failed to init snapshot store', err)
      return null
    }
  }
  if (!db || !stmts) return null
  try {
    return writeSnapshot(db, stmts, input, retention)
  } catch (err) {
    console.error('[history] writeSnapshot failed', err)
    return null
  }
}
