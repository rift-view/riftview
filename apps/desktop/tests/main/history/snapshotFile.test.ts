import { describe, expect, it } from 'vitest'
import {
  SNAPSHOT_FILE_SCHEMA_VERSION,
  SnapshotFileError,
  parseSnapshotFile,
  serializeSnapshotFile,
  snapshotFileIdentity,
  snapshotToFile,
  type SnapshotFileV1
} from '../../../src/main/history/snapshotFile'
import type { Snapshot } from '../../../src/main/history/read'

function makeSnapshot(): Snapshot {
  return {
    meta: {
      id: '01HRX000000000000000000000',
      timestamp: '2026-04-20T10:00:00.000Z',
      profile: 'default',
      region: 'us-east-1',
      endpoint: null,
      contentHash: 'abc123',
      scanMeta: {
        scanErrors: ['ec2/us-east-1: throttled'],
        nodeCount: 1,
        edgeCount: 0,
        pluginId: 'com.riftview.aws',
        pluginVersion: '0.2.0',
        schemaVersion: 1
      }
    },
    nodes: [
      {
        id: 'i-abc',
        type: 'aws:ec2',
        label: 'api',
        status: 'running',
        region: 'us-east-1',
        metadata: { instanceType: 't3.micro' }
      }
    ],
    edges: []
  }
}

describe('snapshotFile', () => {
  it('snapshotToFile produces a schema-v1 envelope matching the CLI shape', () => {
    const snap = makeSnapshot()
    const file = snapshotToFile(snap)
    expect(file.schemaVersion).toBe(SNAPSHOT_FILE_SCHEMA_VERSION)
    expect(file.command).toBe('scan')
    expect(file.profile).toBe('default')
    expect(file.regions).toEqual(['us-east-1'])
    expect(file.timestamp).toBe('2026-04-20T10:00:00.000Z')
    expect(file.nodes).toHaveLength(1)
    expect(file.edges).toEqual([])
    // scanError string decoded to structured object
    expect(file.scanErrors[0]).toEqual({
      service: 'ec2',
      region: 'us-east-1',
      message: 'throttled'
    })
  })

  it('serialize → parse round-trips without loss', () => {
    const file = snapshotToFile(makeSnapshot())
    const raw = serializeSnapshotFile(file)
    // Canonical formatting — 2-space indent, trailing newline.
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw.includes('  "schemaVersion"')).toBe(true)
    const parsed = parseSnapshotFile(raw)
    expect(parsed).toEqual(file)
  })

  it('parseSnapshotFile rejects non-JSON', () => {
    expect(() => parseSnapshotFile('not json')).toThrow(SnapshotFileError)
  })

  it('parseSnapshotFile rejects unsupported schema versions', () => {
    const wrong = JSON.stringify({
      schemaVersion: 999,
      command: 'scan',
      profile: 'default',
      regions: ['us-east-1'],
      timestamp: '2026-04-20T10:00:00.000Z',
      durationMs: 0,
      nodes: [],
      edges: [],
      scanErrors: [],
      topRisks: []
    })
    try {
      parseSnapshotFile(wrong)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(SnapshotFileError)
      expect((err as SnapshotFileError).code).toBe('unsupported_schema')
    }
  })

  it('parseSnapshotFile rejects wrong command', () => {
    const wrong = JSON.stringify({
      schemaVersion: SNAPSHOT_FILE_SCHEMA_VERSION,
      command: 'diff',
      profile: 'default',
      regions: ['us-east-1'],
      timestamp: '2026-04-20T10:00:00.000Z',
      durationMs: 0,
      nodes: [],
      edges: [],
      scanErrors: [],
      topRisks: []
    })
    try {
      parseSnapshotFile(wrong)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(SnapshotFileError)
      expect((err as SnapshotFileError).code).toBe('unsupported_command')
    }
  })

  it('parseSnapshotFile rejects a malformed node entry', () => {
    const wrong: SnapshotFileV1 = {
      schemaVersion: SNAPSHOT_FILE_SCHEMA_VERSION,
      command: 'scan',
      profile: 'default',
      regions: ['us-east-1'],
      timestamp: '2026-04-20T10:00:00.000Z',
      durationMs: 0,
      // missing id
      nodes: [{ type: 'aws:ec2', label: 'x', status: 'running', region: 'us-east-1' } as never],
      edges: [],
      scanErrors: [],
      topRisks: []
    }
    try {
      parseSnapshotFile(JSON.stringify(wrong))
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(SnapshotFileError)
    }
  })

  it('snapshotFileIdentity projects profile/region/endpoint for the mismatch banner', () => {
    const file = snapshotToFile({
      ...makeSnapshot(),
      meta: { ...makeSnapshot().meta, endpoint: 'http://localstack:4566' }
    })
    expect(snapshotFileIdentity(file)).toEqual({
      profile: 'default',
      region: 'us-east-1',
      endpoint: 'http://localstack:4566'
    })
  })
})
