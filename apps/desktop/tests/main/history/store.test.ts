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
  deleteSnapshotSafe,
  initSnapshotStore,
  isSnapshotStoreOpen,
  listVersionsSafe,
  readSnapshotSafe,
  validateListFilter,
  writeSnapshotSafe
} from '../../../src/main/history/store'
import type { CloudNode } from '@riftview/shared'

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

  describe('validateListFilter', () => {
    it('accepts undefined → empty filter', () => {
      expect(validateListFilter(undefined)).toEqual({})
    })

    it('accepts valid filter object', () => {
      expect(validateListFilter({ profile: 'dev', region: 'us-east-1', limit: 10 })).toEqual({
        profile: 'dev',
        region: 'us-east-1',
        limit: 10
      })
    })

    it('rejects non-object input', () => {
      expect(() => validateListFilter('bogus')).toThrow(TypeError)
      expect(() => validateListFilter(42)).toThrow(TypeError)
    })

    it('rejects wrong field types', () => {
      expect(() => validateListFilter({ profile: 123 })).toThrow(TypeError)
      expect(() => validateListFilter({ region: [] })).toThrow(TypeError)
      expect(() => validateListFilter({ limit: '10' })).toThrow(TypeError)
      expect(() => validateListFilter({ limit: 1.5 })).toThrow(TypeError)
      expect(() => validateListFilter({ limit: 0 })).toThrow(TypeError)
      expect(() => validateListFilter({ limit: 501 })).toThrow(TypeError)
    })
  })

  describe('snapshot safe functions — read path', () => {
    const sampleInput = (): {
      profile: string
      endpoint: null
      regions: string[]
      pluginId: string
      pluginVersion: string
      scanErrors: string[]
      nodes: CloudNode[]
    } => ({
      profile: 'default',
      endpoint: null,
      regions: ['us-east-1'],
      pluginId: 'com.riftview.aws',
      pluginVersion: '0.1.0',
      scanErrors: [],
      nodes: [
        {
          id: 'n1',
          type: 'ec2',
          label: 'n1',
          status: 'running',
          region: 'us-east-1',
          metadata: {}
        }
      ]
    })

    it('listVersionsSafe returns [] when store unreachable', () => {
      expect(listVersionsSafe()).toEqual([])
    })

    it('listVersionsSafe returns versions once store initialized + written', () => {
      initSnapshotStore(join(dir, 'store.db'))
      writeSnapshotSafe(sampleInput())
      const versions = listVersionsSafe()
      expect(versions).toHaveLength(1)
      expect(versions[0].profile).toBe('default')
    })

    it('listVersionsSafe validates filter input before touching DB', () => {
      initSnapshotStore(join(dir, 'store.db'))
      expect(() => listVersionsSafe({ profile: 123 })).toThrow(TypeError)
    })

    it('readSnapshotSafe rejects non-string versionId', () => {
      initSnapshotStore(join(dir, 'store.db'))
      expect(() => readSnapshotSafe(123)).toThrow(TypeError)
      expect(() => readSnapshotSafe(null)).toThrow(TypeError)
    })

    it('readSnapshotSafe rejects versionId with illegal characters', () => {
      initSnapshotStore(join(dir, 'store.db'))
      expect(() => readSnapshotSafe('../etc/passwd')).toThrow(TypeError)
      expect(() => readSnapshotSafe("'; DROP TABLE versions; --")).toThrow(TypeError)
    })

    it('readSnapshotSafe returns the snapshot for a valid id', () => {
      initSnapshotStore(join(dir, 'store.db'))
      const { versionIds } = writeSnapshotSafe(sampleInput())!
      const snap = readSnapshotSafe(versionIds[0])
      expect(snap).not.toBeNull()
      expect(snap!.nodes).toHaveLength(1)
    })

    it('readSnapshotSafe returns null for a well-formed but unknown id', () => {
      initSnapshotStore(join(dir, 'store.db'))
      expect(readSnapshotSafe('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBeNull()
    })

    it('deleteSnapshotSafe rejects non-string versionId', () => {
      initSnapshotStore(join(dir, 'store.db'))
      expect(() => deleteSnapshotSafe(42)).toThrow(TypeError)
    })

    it('deleteSnapshotSafe removes an existing version', () => {
      initSnapshotStore(join(dir, 'store.db'))
      const { versionIds } = writeSnapshotSafe(sampleInput())!
      expect(deleteSnapshotSafe(versionIds[0])).toEqual({ ok: true })
      expect(readSnapshotSafe(versionIds[0])).toBeNull()
    })

    it('deleteSnapshotSafe returns ok=false for an unknown id', () => {
      initSnapshotStore(join(dir, 'store.db'))
      expect(deleteSnapshotSafe('01ARZ3NDEKTSV4RRFFQ69G5FAV')).toEqual({ ok: false })
    })
  })
})
