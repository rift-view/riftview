import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { readSnapshot, writeSnapshot } from '../cli/snapshot'
import { SCHEMA_VERSION, type ScanOutput } from '../cli/output/schema'

function makeOutput(): ScanOutput {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: 'scan',
    profile: 'default',
    regions: ['us-east-1'],
    timestamp: '2026-04-20T12:00:00.000Z',
    durationMs: 42,
    nodes: [],
    edges: [],
    scanErrors: [],
    topRisks: []
  }
}

describe('snapshot', () => {
  it('writes then reads back identically', () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-snap-'))
    const path = join(dir, 'scan.json')
    const original = makeOutput()
    writeSnapshot(path, original)

    const round = readSnapshot(path)
    expect(round).toEqual(original)
    // file is JSON with trailing newline
    const raw = readFileSync(path, 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
  })

  it('rejects files with unknown schemaVersion via UsageError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-snap-'))
    const path = join(dir, 'future.json')
    writeFileSync(path, JSON.stringify({ ...makeOutput(), schemaVersion: 99 }, null, 2), 'utf8')
    expect(() => readSnapshot(path)).toThrow(/unsupported schemaVersion 99/)
  })

  it('rejects missing files', () => {
    expect(() => readSnapshot('/no/such/file.json')).toThrow(/Cannot read snapshot/)
  })

  it('rejects non-scan outputs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-snap-'))
    const path = join(dir, 'wrong.json')
    writeFileSync(path, JSON.stringify({ ...makeOutput(), command: 'diff' }, null, 2), 'utf8')
    expect(() => readSnapshot(path)).toThrow(/expected 'scan'/)
  })
})
