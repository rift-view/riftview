import { describe, expect, it } from 'vitest'
import type { CloudNode } from '@riftview/shared'
import {
  canonicalize,
  contentHash,
  type EdgeRecord,
  type ScanPayload
} from '@riftview/shared/snapshot'

function node(id: string, extra: Partial<CloudNode> = {}): CloudNode {
  return {
    id,
    type: 'ec2',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...extra
  }
}

function payload(overrides: Partial<ScanPayload> = {}): ScanPayload {
  return {
    nodes: [node('a'), node('b')],
    edges: [],
    meta: {
      scanErrors: [],
      nodeCount: 2,
      edgeCount: 0,
      pluginId: 'aws',
      pluginVersion: '0.1.0',
      schemaVersion: 1
    },
    ...overrides
  }
}

describe('canonical-form serializer', () => {
  it('is deterministic: same payload produces identical output', () => {
    const p = payload()
    expect(canonicalize(p)).toBe(canonicalize(p))
    expect(contentHash(p)).toBe(contentHash(p))
  })

  it('hashes are stable across independent payload construction', () => {
    const a = payload()
    const b = payload()
    expect(contentHash(a)).toBe(contentHash(b))
  })

  it('is independent of top-level object key insertion order', () => {
    const p1 = payload({
      meta: {
        scanErrors: [],
        nodeCount: 2,
        edgeCount: 0,
        pluginId: 'aws',
        pluginVersion: '0.1.0',
        schemaVersion: 1
      }
    })
    const p2: ScanPayload = {
      meta: {
        schemaVersion: 1,
        pluginVersion: '0.1.0',
        pluginId: 'aws',
        edgeCount: 0,
        nodeCount: 2,
        scanErrors: []
      },
      edges: [],
      nodes: [node('a'), node('b')]
    }
    expect(contentHash(p1)).toBe(contentHash(p2))
  })

  it('is independent of node array order (nodes sorted by id)', () => {
    const asc = payload({ nodes: [node('a'), node('b'), node('c')] })
    const desc = payload({ nodes: [node('c'), node('b'), node('a')] })
    expect(contentHash(asc)).toBe(contentHash(desc))
  })

  it('is independent of edge array order (edges sorted by from|to|edgeType)', () => {
    const edgesA: EdgeRecord[] = [
      { from: 'a', to: 'b', edgeType: 'trigger' },
      { from: 'b', to: 'c', edgeType: 'subscription' }
    ]
    const edgesB: EdgeRecord[] = [
      { from: 'b', to: 'c', edgeType: 'subscription' },
      { from: 'a', to: 'b', edgeType: 'trigger' }
    ]
    expect(contentHash(payload({ edges: edgesA, meta: { ...payload().meta, edgeCount: 2 } }))).toBe(
      contentHash(payload({ edges: edgesB, meta: { ...payload().meta, edgeCount: 2 } }))
    )
  })

  it('is independent of integration array order (sorted by targetId|edgeType)', () => {
    const n1 = node('a', {
      integrations: [
        { targetId: 'q2', edgeType: 'subscription' },
        { targetId: 'q1', edgeType: 'trigger' }
      ]
    })
    const n2 = node('a', {
      integrations: [
        { targetId: 'q1', edgeType: 'trigger' },
        { targetId: 'q2', edgeType: 'subscription' }
      ]
    })
    expect(contentHash(payload({ nodes: [n1] }))).toBe(contentHash(payload({ nodes: [n2] })))
  })

  it('is independent of nested metadata key order', () => {
    const a = node('x', {
      metadata: { vpc: 'v1', az: 'us-east-1a', tags: { team: 'ops', env: 'prod' } }
    })
    const b = node('x', {
      metadata: { tags: { env: 'prod', team: 'ops' }, az: 'us-east-1a', vpc: 'v1' }
    })
    expect(contentHash(payload({ nodes: [a] }))).toBe(contentHash(payload({ nodes: [b] })))
  })

  it('scanErrors order IS preserved (encodes failure sequence)', () => {
    const ordered = payload({
      meta: { ...payload().meta, scanErrors: ['rds-scan-failed', 'lambda-scan-failed'] }
    })
    const reversed = payload({
      meta: { ...payload().meta, scanErrors: ['lambda-scan-failed', 'rds-scan-failed'] }
    })
    expect(contentHash(ordered)).not.toBe(contentHash(reversed))
  })

  it('distinguishes different payloads', () => {
    const a = payload({ nodes: [node('a')] })
    const b = payload({ nodes: [node('b')] })
    expect(contentHash(a)).not.toBe(contentHash(b))
  })

  it('distinguishes shape/metadata changes on the same node id', () => {
    const base = payload({ nodes: [node('a', { metadata: { instanceType: 't3.micro' } })] })
    const drifted = payload({ nodes: [node('a', { metadata: { instanceType: 't3.small' } })] })
    expect(contentHash(base)).not.toBe(contentHash(drifted))
  })

  it('returns 64-character lowercase hex for SHA-256', () => {
    const h = contentHash(payload())
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('distinguishes plugin-version drift', () => {
    const v1 = payload({ meta: { ...payload().meta, pluginVersion: '0.1.0' } })
    const v2 = payload({ meta: { ...payload().meta, pluginVersion: '0.2.0' } })
    expect(contentHash(v1)).not.toBe(contentHash(v2))
  })
})
