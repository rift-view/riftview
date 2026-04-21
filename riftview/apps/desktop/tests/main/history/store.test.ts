import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn().mockReturnValue('/nonexistent/userData') }
}))

import {
  closeSnapshotStore,
  defaultSnapshotDbPath,
  initSnapshotStore,
  isSnapshotStoreOpen,
  writeSnapshotSafe
} from '../../../src/main/history/store'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'riftview-store-'))
  closeSnapshotStore()
})
afterEach(() => {
  closeSnapshotStore()
  rmSync(dir, { recursive: true, force: true })
})

describe('history/store', () => {
  it('initSnapshotStore opens the db, closeSnapshotStore releases it', () => {
    expect(isSnapshotStoreOpen()).toBe(false)
    initSnapshotStore(join(dir, 'store.db'))
    expect(isSnapshotStoreOpen()).toBe(true)
    closeSnapshotStore()
    expect(isSnapshotStoreOpen()).toBe(false)
  })

  it('writeSnapshotSafe lazily initializes the store when not open', () => {
    const result = writeSnapshotSafe({
      profile: 'default',
      endpoint: null,
      regions: ['us-east-1'],
      pluginId: 'com.riftview.aws',
      pluginVersion: '0.1.0',
      scanErrors: [],
      nodes: []
    })
    // defaultSnapshotDbPath() will try to write under /nonexistent/userData/snapshots.db;
    // better-sqlite3 will throw → caught → returns null. Proves error isolation.
    expect(result).toBeNull()
    expect(isSnapshotStoreOpen()).toBe(false)
  })

  it('writeSnapshotSafe returns a result when store is pre-initialized', () => {
    initSnapshotStore(join(dir, 'store.db'))
    const result = writeSnapshotSafe({
      profile: 'default',
      endpoint: null,
      regions: ['us-east-1'],
      pluginId: 'com.riftview.aws',
      pluginVersion: '0.1.0',
      scanErrors: [],
      nodes: []
    })
    expect(result).not.toBeNull()
    expect(result?.versionIds).toHaveLength(1)
  })

  it('defaultSnapshotDbPath routes through electron.app.getPath', () => {
    expect(defaultSnapshotDbPath()).toBe('/nonexistent/userData/snapshots.db')
  })
})
