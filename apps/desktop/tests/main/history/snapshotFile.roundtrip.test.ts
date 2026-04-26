/**
 * RIFT-40 round-trip smoke: a CLI-produced fixture imported via the desktop
 * store and re-exported yields a byte-equal file, modulo the synthetic
 * versionId (which lives in the desktop store, not the file) and the
 * durationMs/topRisks fields (CLI-only metadata not preserved in SQLite).
 *
 * This is an integration test of the history/write.ts + snapshotFile.ts
 * composition — the bits the renderer-facing Export/Import IPC handlers
 * stitch together. Running it against the SQLite store in :memory: gives us
 * coverage of the actual persistence path without needing Electron boot.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  closeDb,
  openDb,
  prepareStatements,
  type Db,
  type Statements
} from '../../../src/main/history/db'
import { readSnapshot } from '../../../src/main/history/read'
import { writeSnapshot } from '../../../src/main/history/write'
import {
  parseSnapshotFile,
  serializeSnapshotFile,
  snapshotToFile
} from '../../../src/main/history/snapshotFile'

function setupDb(): { db: Db; stmts: Statements; close: () => void } {
  const db = openDb(':memory:')
  const stmts = prepareStatements(db)
  return { db, stmts, close: () => closeDb(db) }
}

describe('RIFT-40 snapshot file round-trip', () => {
  it('CLI fixture → import → export yields a graph-equal file', () => {
    // A CLI-produced fixture. Structure matches apps/cli/tests/fixtures/snapshots/a.json.
    const fixturePath = join(__dirname, '../../../../cli/tests/fixtures/snapshots/a.json')
    const raw = readFileSync(fixturePath, 'utf-8')
    const originalFile = parseSnapshotFile(raw)

    const { db, stmts, close } = setupDb()
    try {
      // Simulate the import handler: persist via writeSnapshot() using the
      // file's own timestamp as the clock, so ordering + meta mirror the
      // operator's history.
      const fileDate = new Date(originalFile.timestamp)
      const writeResult = writeSnapshot(
        db,
        stmts,
        {
          profile: originalFile.profile,
          endpoint: originalFile.endpoint ?? null,
          regions: originalFile.regions,
          pluginId: 'com.riftview.aws',
          pluginVersion: '0.2.0',
          scanErrors: originalFile.scanErrors.map(
            (e) => `${e.service ?? 'unknown'}/${e.region ?? 'unknown'}: ${e.message}`
          ),
          nodes: originalFile.nodes
        },
        50,
        () => fileDate
      )
      expect(writeResult.versionIds).toHaveLength(1)
      const versionId = writeResult.versionIds[0]

      // Now simulate the export handler.
      const snap = readSnapshot(db, stmts, versionId)
      expect(snap).not.toBeNull()
      const roundTrippedFile = snapshotToFile(snap!)
      const roundTrippedRaw = serializeSnapshotFile(roundTrippedFile)

      // Byte-equality modulo the fields we legitimately drop. To check that,
      // parse both back and compare graph-meaningful subsets.
      const reparsed = parseSnapshotFile(roundTrippedRaw)

      expect(reparsed.schemaVersion).toBe(originalFile.schemaVersion)
      expect(reparsed.command).toBe(originalFile.command)
      expect(reparsed.profile).toBe(originalFile.profile)
      expect(reparsed.regions).toEqual(originalFile.regions)
      expect(reparsed.timestamp).toBe(originalFile.timestamp)
      // Node ordering on readout is governed by SQLite's index order, not
      // insertion order. Treat nodes as a set keyed by id so the round-trip
      // is compared on graph identity, not wire order.
      const byId = <T extends { id: string }>(arr: T[]): T[] =>
        [...arr].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      expect(byId(reparsed.nodes)).toEqual(byId(originalFile.nodes))
      // Edges: CLI fixture has none; the desktop derives them from
      // `node.integrations`. Both should be empty here.
      expect(reparsed.edges).toEqual(originalFile.edges)
    } finally {
      close()
    }
  })

  it('preserves the scannedAt timestamp on import (does not use Date.now)', () => {
    const { db, stmts, close } = setupDb()
    try {
      const file = parseSnapshotFile(
        JSON.stringify({
          schemaVersion: 1,
          command: 'scan',
          profile: 'prod',
          regions: ['eu-west-1'],
          timestamp: '2020-01-01T00:00:00.000Z',
          durationMs: 5,
          nodes: [
            {
              id: 'i-1',
              type: 'aws:ec2',
              label: 'one',
              status: 'running',
              region: 'eu-west-1',
              metadata: {}
            }
          ],
          edges: [],
          scanErrors: [],
          topRisks: []
        })
      )
      const fileDate = new Date(file.timestamp)
      const result = writeSnapshot(
        db,
        stmts,
        {
          profile: file.profile,
          endpoint: null,
          regions: file.regions,
          pluginId: 'com.riftview.aws',
          pluginVersion: '0.2.0',
          scanErrors: [],
          nodes: file.nodes
        },
        50,
        () => fileDate
      )
      const snap = readSnapshot(db, stmts, result.versionIds[0])
      expect(snap?.meta.timestamp).toBe('2020-01-01T00:00:00.000Z')
    } finally {
      close()
    }
  })
})
