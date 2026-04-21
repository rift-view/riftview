import { readFileSync, writeFileSync } from 'node:fs'
import { UsageError } from './errors'
import { toJson } from './output/json'
import { SCHEMA_VERSION, type ScanOutput } from './output/schema'

/** Write a ScanOutput snapshot to disk. Deterministic JSON (2-space indent). */
export function writeSnapshot(path: string, snapshot: ScanOutput): void {
  writeFileSync(path, toJson(snapshot) + '\n', 'utf8')
}

/**
 * Read a snapshot file. Throws UsageError (exit code 2) on missing file,
 * malformed JSON, or unsupported schema version — the file is a user-supplied
 * artefact so all parse failures surface as USAGE, not RUNTIME.
 */
export function readSnapshot(path: string): ScanOutput {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch (err) {
    throw new UsageError(
      `Cannot read snapshot at ${path}: ${(err as Error).message ?? String(err)}`
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new UsageError(
      `Snapshot at ${path} is not valid JSON: ${(err as Error).message ?? String(err)}`
    )
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new UsageError(`Snapshot at ${path} is not an object`)
  }

  const snap = parsed as Partial<ScanOutput>
  if (snap.schemaVersion !== SCHEMA_VERSION) {
    throw new UsageError(
      `Snapshot at ${path} has unsupported schemaVersion ${String(snap.schemaVersion)} (expected ${SCHEMA_VERSION})`
    )
  }
  if (snap.command !== 'scan') {
    throw new UsageError(
      `Snapshot at ${path} is a '${String(snap.command)}' output, expected 'scan'`
    )
  }
  return snap as ScanOutput
}
