import Database from 'better-sqlite3'
import { HISTORY_SCHEMA_VERSION } from './types'

export type Db = Database.Database

export class SchemaVersionError extends Error {
  constructor(
    public readonly found: number,
    public readonly expected: number
  ) {
    super(`History DB schema_version=${found}, expected ${expected}`)
    this.name = 'SchemaVersionError'
  }
}

const SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY NOT NULL,
    timestamp TEXT NOT NULL,
    profile TEXT NOT NULL,
    region TEXT NOT NULL,
    endpoint TEXT,
    scan_meta_json TEXT NOT NULL,
    content_hash TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_versions_timestamp ON versions(timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_versions_profile_region ON versions(profile, region, timestamp DESC)`,
  `CREATE TABLE IF NOT EXISTS nodes (
    version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL,
    region TEXT NOT NULL,
    parent_id TEXT,
    shape_json TEXT NOT NULL,
    data_json TEXT NOT NULL,
    integrations_json TEXT,
    tf_metadata_json TEXT,
    drift_status TEXT,
    PRIMARY KEY (version_id, node_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(version_id, node_type)`,
  `CREATE TABLE IF NOT EXISTS edges (
    version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    from_id TEXT NOT NULL,
    to_id TEXT NOT NULL,
    edge_type TEXT NOT NULL,
    edge_data_json TEXT,
    PRIMARY KEY (version_id, from_id, to_id, edge_type)
  )`
]

export function openDb(path: string): Db {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  bootstrap(db)
  return db
}

function bootstrap(db: Db): void {
  db.exec('BEGIN')
  try {
    for (const ddl of SCHEMA_DDL) db.exec(ddl)

    const row = db
      .prepare<[], { value: string }>(`SELECT value FROM schema_meta WHERE key = 'schema_version'`)
      .get()

    if (!row) {
      db.prepare(`INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)`).run(
        String(HISTORY_SCHEMA_VERSION)
      )
    } else {
      const found = Number(row.value)
      if (found !== HISTORY_SCHEMA_VERSION) {
        db.exec('ROLLBACK')
        throw new SchemaVersionError(found, HISTORY_SCHEMA_VERSION)
      }
    }
    db.exec('COMMIT')
  } catch (err) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // already rolled back or not in transaction
    }
    throw err
  }
}

export function closeDb(db: Db): void {
  db.close()
}

export function withTransaction<T>(db: Db, fn: (db: Db) => T): T {
  const tx = db.transaction(fn)
  return tx(db)
}

export interface Statements {
  insertVersion: Database.Statement<[string, string, string, string, string | null, string, string]>
  insertNode: Database.Statement<
    [
      string,
      string,
      string,
      string,
      string,
      string,
      string | null,
      string,
      string,
      string | null,
      string | null,
      string | null
    ]
  >
  insertEdge: Database.Statement<[string, string, string, string, string | null]>
  selectVersionById: Database.Statement<[string]>
  selectNodesByVersion: Database.Statement<[string]>
  selectEdgesByVersion: Database.Statement<[string]>
  listVersionsAll: Database.Statement<[number]>
  listVersionsByProfile: Database.Statement<[string, number]>
  listVersionsByProfileRegion: Database.Statement<[string, string, number]>
  deleteVersion: Database.Statement<[string]>
  countVersions: Database.Statement<[]>
  pruneVersions: Database.Statement<[number]>
}

export function prepareStatements(db: Db): Statements {
  return {
    insertVersion: db.prepare(
      `INSERT INTO versions (id, timestamp, profile, region, endpoint, scan_meta_json, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ),
    insertNode: db.prepare(
      `INSERT INTO nodes (
        version_id, node_id, node_type, label, status, region, parent_id,
        shape_json, data_json, integrations_json, tf_metadata_json, drift_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ),
    insertEdge: db.prepare(
      `INSERT INTO edges (version_id, from_id, to_id, edge_type, edge_data_json)
       VALUES (?, ?, ?, ?, ?)`
    ),
    selectVersionById: db.prepare(
      `SELECT id, timestamp, profile, region, endpoint, scan_meta_json, content_hash
       FROM versions WHERE id = ?`
    ),
    selectNodesByVersion: db.prepare(
      `SELECT node_id, node_type, label, status, region, parent_id,
              shape_json, data_json, integrations_json, tf_metadata_json, drift_status
       FROM nodes WHERE version_id = ? ORDER BY node_id`
    ),
    selectEdgesByVersion: db.prepare(
      `SELECT from_id, to_id, edge_type, edge_data_json
       FROM edges WHERE version_id = ? ORDER BY from_id, to_id, edge_type`
    ),
    listVersionsAll: db.prepare(
      `SELECT id, timestamp, profile, region, endpoint, scan_meta_json, content_hash
       FROM versions ORDER BY timestamp DESC LIMIT ?`
    ),
    listVersionsByProfile: db.prepare(
      `SELECT id, timestamp, profile, region, endpoint, scan_meta_json, content_hash
       FROM versions WHERE profile = ? ORDER BY timestamp DESC LIMIT ?`
    ),
    listVersionsByProfileRegion: db.prepare(
      `SELECT id, timestamp, profile, region, endpoint, scan_meta_json, content_hash
       FROM versions WHERE profile = ? AND region = ? ORDER BY timestamp DESC LIMIT ?`
    ),
    deleteVersion: db.prepare(`DELETE FROM versions WHERE id = ?`),
    countVersions: db.prepare(`SELECT COUNT(*) AS n FROM versions`),
    pruneVersions: db.prepare(
      `DELETE FROM versions WHERE id NOT IN (
         SELECT id FROM versions ORDER BY timestamp DESC LIMIT ?
       )`
    )
  }
}
