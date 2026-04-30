import { describe, expect, it } from 'vitest'
import {
  SCAN_FILE_VERSION,
  ScanFileError,
  buildScanFile,
  parseScanFile,
  scanFileDefaultName,
  serializeScanFile
} from '../../../src/main/scan/scanFile'
import type { CloudNode } from '@riftview/shared'

function makeNode(id: string, type: CloudNode['type'] = 'aws:ec2'): CloudNode {
  return {
    id,
    type,
    label: `node-${id}`,
    status: 'running',
    region: 'us-east-1',
    metadata: {}
  }
}

describe('scanFile', () => {
  it('buildScanFile produces a v1 envelope tagged with kind=riftview-scan', () => {
    const file = buildScanFile({
      nodes: [makeNode('i-1')],
      scannedAt: '2026-04-26T18:00:00.000Z',
      profile: 'default'
    })
    expect(file.version).toBe(SCAN_FILE_VERSION)
    expect(file.kind).toBe('riftview-scan')
    expect(file.profile).toBe('default')
    expect(file.scannedAt).toBe('2026-04-26T18:00:00.000Z')
    expect(file.nodes).toHaveLength(1)
    // edges omitted when none provided
    expect(file.edges).toBeUndefined()
  })

  it('serialized output is human-readable (2-space indent, trailing newline)', () => {
    const file = buildScanFile({
      nodes: [makeNode('i-1')],
      scannedAt: '2026-04-26T18:00:00.000Z',
      profile: 'default'
    })
    const raw = serializeScanFile(file)
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toContain('  "version": 1')
    expect(raw).toContain('  "kind": "riftview-scan"')
  })

  it('round-trip preserves node count, ids, and types exactly', () => {
    const nodes: CloudNode[] = [
      makeNode('i-1', 'aws:ec2'),
      makeNode('lambda-handler', 'aws:lambda'),
      makeNode('bucket-x', 'aws:s3')
    ]
    const file = buildScanFile({
      nodes,
      scannedAt: '2026-04-26T18:00:00.000Z',
      profile: 'staging',
      edges: [{ source: 'lambda-handler', target: 'bucket-x' }]
    })
    const raw = serializeScanFile(file)
    const parsed = parseScanFile(raw)
    expect(parsed.nodes).toHaveLength(nodes.length)
    expect(parsed.nodes.map((n) => n.id)).toEqual(nodes.map((n) => n.id))
    expect(parsed.nodes.map((n) => n.type)).toEqual(nodes.map((n) => n.type))
    expect(parsed.edges).toEqual([{ source: 'lambda-handler', target: 'bucket-x' }])
    expect(parsed.profile).toBe('staging')
    expect(parsed.scannedAt).toBe('2026-04-26T18:00:00.000Z')
  })

  it('emitted output carries the version field for forward-compat', () => {
    const file = buildScanFile({
      nodes: [makeNode('i-1')],
      scannedAt: '2026-04-26T18:00:00.000Z',
      profile: 'default'
    })
    const raw = serializeScanFile(file)
    const obj = JSON.parse(raw) as { version: number }
    expect(obj.version).toBe(1)
  })

  it('parseScanFile rejects malformed JSON cleanly (no uncaught throw)', () => {
    let caught: unknown
    try {
      parseScanFile('not valid json {{{')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScanFileError)
    expect((caught as ScanFileError).code).toBe('invalid_json')
  })

  it('parseScanFile rejects when version field is missing', () => {
    const raw = JSON.stringify({
      kind: 'riftview-scan',
      profile: 'default',
      scannedAt: '2026-04-26T18:00:00.000Z',
      nodes: []
    })
    let caught: unknown
    try {
      parseScanFile(raw)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScanFileError)
    expect((caught as ScanFileError).code).toBe('missing_version')
  })

  it('parseScanFile rejects unsupported version', () => {
    const raw = JSON.stringify({
      version: 999,
      kind: 'riftview-scan',
      profile: 'default',
      scannedAt: '2026-04-26T18:00:00.000Z',
      nodes: []
    })
    let caught: unknown
    try {
      parseScanFile(raw)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScanFileError)
    expect((caught as ScanFileError).code).toBe('unsupported_version')
  })

  it('parseScanFile rejects a snapshot-file masquerading as a scan-file (kind mismatch)', () => {
    const raw = JSON.stringify({
      version: 1,
      kind: 'riftview-snapshot',
      profile: 'default',
      scannedAt: '2026-04-26T18:00:00.000Z',
      nodes: []
    })
    let caught: unknown
    try {
      parseScanFile(raw)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScanFileError)
    expect((caught as ScanFileError).code).toBe('wrong_kind')
  })

  it('parseScanFile rejects when nodes field is missing', () => {
    const raw = JSON.stringify({
      version: 1,
      kind: 'riftview-scan',
      profile: 'default',
      scannedAt: '2026-04-26T18:00:00.000Z'
    })
    let caught: unknown
    try {
      parseScanFile(raw)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScanFileError)
    expect((caught as ScanFileError).code).toBe('invalid_shape')
  })

  it('parseScanFile rejects a malformed node entry', () => {
    const raw = JSON.stringify({
      version: 1,
      kind: 'riftview-scan',
      profile: 'default',
      scannedAt: '2026-04-26T18:00:00.000Z',
      // missing id
      nodes: [{ type: 'aws:ec2', region: 'us-east-1' }]
    })
    let caught: unknown
    try {
      parseScanFile(raw)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(ScanFileError)
    expect((caught as ScanFileError).code).toBe('invalid_shape')
  })

  it('parseScanFile accepts a scan-file with no kind field (forward-compat ingest)', () => {
    // The kind discriminator is optional on ingest — only required to match
    // when present. This keeps room for older/simpler emitters.
    const raw = JSON.stringify({
      version: 1,
      profile: 'default',
      scannedAt: '2026-04-26T18:00:00.000Z',
      nodes: [
        {
          id: 'i-1',
          type: 'aws:ec2',
          label: 'x',
          status: 'running',
          region: 'us-east-1',
          metadata: {}
        }
      ]
    })
    const parsed = parseScanFile(raw)
    expect(parsed.nodes).toHaveLength(1)
  })

  it('scanFileDefaultName builds a POSIX-friendly filename', () => {
    const name = scanFileDefaultName('staging', '2026-04-26T18:00:00.000Z')
    expect(name).toBe('riftview-scan-staging-2026-04-26T18-00-00-000Z.json')
    expect(name).not.toContain(':')
  })
})
