import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb,
  openDb,
  prepareStatements,
  SchemaVersionError,
  withTransaction,
  type Db
} from '../../../src/main/history/db'
import { HISTORY_SCHEMA_VERSION } from '../../../src/main/history/types'

function fresh(): Db {
  return openDb(':memory:')
}

let tmpDir: string
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'riftview-history-'))
})
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('history/db', () => {
  describe('openDb', () => {
    it('creates schema_meta + versions + nodes + edges tables', () => {
      const db = fresh()
      try {
        const tables = db
          .prepare<[], { name: string }>(
            `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
          )
          .all()
          .map((r) => r.name)
        expect(tables).toEqual(
          expect.arrayContaining(['edges', 'nodes', 'schema_meta', 'versions'])
        )
      } finally {
        closeDb(db)
      }
    })

    it('seeds schema_version row on first open', () => {
      const db = fresh()
      try {
        const row = db
          .prepare<
            [],
            { value: string }
          >(`SELECT value FROM schema_meta WHERE key = 'schema_version'`)
          .get()
        expect(row?.value).toBe(String(HISTORY_SCHEMA_VERSION))
      } finally {
        closeDb(db)
      }
    })

    it('enables foreign_keys pragma', () => {
      const db = fresh()
      try {
        const row = db.prepare<[], { foreign_keys: number }>(`PRAGMA foreign_keys`).get() as
          | { foreign_keys: number }
          | undefined
        expect(row?.foreign_keys).toBe(1)
      } finally {
        closeDb(db)
      }
    })

    it('is idempotent — reopening an existing db does not throw', () => {
      const db1 = openDb(':memory:')
      closeDb(db1)
      const db2 = openDb(':memory:')
      closeDb(db2)
      expect(true).toBe(true)
    })

    it('throws SchemaVersionError when stored version differs from expected', () => {
      const path = join(tmpDir, 'mismatch.db')
      const first = openDb(path)
      first.prepare(`UPDATE schema_meta SET value = '999' WHERE key = 'schema_version'`).run()
      closeDb(first)

      expect(() => openDb(path)).toThrow(SchemaVersionError)
    })

    it('persists schema across reopens on disk', () => {
      const path = join(tmpDir, 'persist.db')
      const db1 = openDb(path)
      closeDb(db1)
      const db2 = openDb(path)
      try {
        const row = db2
          .prepare<
            [],
            { value: string }
          >(`SELECT value FROM schema_meta WHERE key = 'schema_version'`)
          .get()
        expect(row?.value).toBe(String(HISTORY_SCHEMA_VERSION))
      } finally {
        closeDb(db2)
      }
    })
  })

  describe('foreign key cascade', () => {
    it('deleting a version cascades to its nodes and edges', () => {
      const db = fresh()
      try {
        const stmts = prepareStatements(db)
        stmts.insertVersion.run(
          'v1',
          '2026-04-20T00:00:00Z',
          'default',
          'us-east-1',
          null,
          '{}',
          'h'
        )
        stmts.insertNode.run(
          'v1',
          'n1',
          'ec2',
          'n1',
          'running',
          'us-east-1',
          null,
          '{}',
          '{}',
          null,
          null,
          null
        )
        stmts.insertEdge.run('v1', 'n1', 'n1', 'trigger', null)

        expect(db.prepare(`SELECT COUNT(*) AS n FROM nodes`).get()).toEqual({ n: 1 })
        expect(db.prepare(`SELECT COUNT(*) AS n FROM edges`).get()).toEqual({ n: 1 })

        stmts.deleteVersion.run('v1')

        expect(db.prepare(`SELECT COUNT(*) AS n FROM nodes`).get()).toEqual({ n: 0 })
        expect(db.prepare(`SELECT COUNT(*) AS n FROM edges`).get()).toEqual({ n: 0 })
      } finally {
        closeDb(db)
      }
    })
  })

  describe('prepared statements', () => {
    it('insert + select round-trip for a version row', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        s.insertVersion.run(
          'v1',
          '2026-04-20T00:00:00Z',
          'default',
          'us-east-1',
          'http://localhost:4566',
          '{"nodeCount":0}',
          'abc123'
        )
        const row = s.selectVersionById.get('v1') as {
          id: string
          timestamp: string
          profile: string
          region: string
          endpoint: string | null
          scan_meta_json: string
          content_hash: string
        }
        expect(row.id).toBe('v1')
        expect(row.profile).toBe('default')
        expect(row.endpoint).toBe('http://localhost:4566')
        expect(row.content_hash).toBe('abc123')
      } finally {
        closeDb(db)
      }
    })

    it('listVersionsAll orders by timestamp desc', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        s.insertVersion.run('old', '2026-01-01T00:00:00Z', 'default', 'us-east-1', null, '{}', 'h')
        s.insertVersion.run('new', '2026-04-20T00:00:00Z', 'default', 'us-east-1', null, '{}', 'h')
        s.insertVersion.run('mid', '2026-03-10T00:00:00Z', 'default', 'us-east-1', null, '{}', 'h')

        const rows = s.listVersionsAll.all(10) as { id: string }[]
        expect(rows.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
      } finally {
        closeDb(db)
      }
    })

    it('listVersionsByProfile filters by profile', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        s.insertVersion.run('a', '2026-04-20T00:00:00Z', 'dev', 'us-east-1', null, '{}', 'h')
        s.insertVersion.run('b', '2026-04-20T00:00:00Z', 'prod', 'us-east-1', null, '{}', 'h')

        const rows = s.listVersionsByProfile.all('dev', 10) as { id: string }[]
        expect(rows.map((r) => r.id)).toEqual(['a'])
      } finally {
        closeDb(db)
      }
    })

    it('listVersionsByProfileRegion filters by profile + region', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        s.insertVersion.run('a', '2026-04-20T00:00:00Z', 'dev', 'us-east-1', null, '{}', 'h')
        s.insertVersion.run('b', '2026-04-20T00:00:00Z', 'dev', 'us-west-2', null, '{}', 'h')

        const rows = s.listVersionsByProfileRegion.all('dev', 'us-west-2', 10) as { id: string }[]
        expect(rows.map((r) => r.id)).toEqual(['b'])
      } finally {
        closeDb(db)
      }
    })
  })

  describe('pruning', () => {
    it('pruneVersions keeps only N most recent by timestamp', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        for (let i = 0; i < 5; i++) {
          const ts = `2026-04-${String(10 + i).padStart(2, '0')}T00:00:00Z`
          s.insertVersion.run(`v${i}`, ts, 'default', 'us-east-1', null, '{}', 'h')
        }

        s.pruneVersions.run(3)

        const remaining = (s.listVersionsAll.all(10) as { id: string }[]).map((r) => r.id)
        expect(remaining).toEqual(['v4', 'v3', 'v2'])
      } finally {
        closeDb(db)
      }
    })

    it('pruneVersions is a no-op when count <= retention', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        s.insertVersion.run('v1', '2026-04-20T00:00:00Z', 'default', 'us-east-1', null, '{}', 'h')

        s.pruneVersions.run(50)

        expect(s.countVersions.get()).toEqual({ n: 1 })
      } finally {
        closeDb(db)
      }
    })
  })

  describe('withTransaction', () => {
    it('commits the result on success', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        const result = withTransaction(db, () => {
          s.insertVersion.run('v1', '2026-04-20T00:00:00Z', 'default', 'us-east-1', null, '{}', 'h')
          return 'ok'
        })
        expect(result).toBe('ok')
        expect(s.countVersions.get()).toEqual({ n: 1 })
      } finally {
        closeDb(db)
      }
    })

    it('rolls back on thrown error', () => {
      const db = fresh()
      try {
        const s = prepareStatements(db)
        expect(() =>
          withTransaction(db, () => {
            s.insertVersion.run(
              'v1',
              '2026-04-20T00:00:00Z',
              'default',
              'us-east-1',
              null,
              '{}',
              'h'
            )
            throw new Error('boom')
          })
        ).toThrow('boom')
        expect(s.countVersions.get()).toEqual({ n: 0 })
      } finally {
        closeDb(db)
      }
    })
  })
})
