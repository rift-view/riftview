import { describe, it, expect, vi } from 'vitest'
import { computeDelta, historyFilePath } from '../scanner'
import type { CloudNode } from '@riftview/shared'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/riftview-test' },
  BrowserWindow: { getAllWindows: vi.fn(() => []) }
}))

describe('computeDelta', () => {
  it('returns empty delta for identical snapshots', () => {
    const nodes: CloudNode[] = [
      {
        id: 'a',
        type: 'aws:ec2',
        label: 'A',
        status: 'running',
        region: 'us-east-1',
        metadata: {}
      }
    ]
    const delta = computeDelta(nodes, nodes)
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('detects added nodes', () => {
    const prev: CloudNode[] = []
    const next: CloudNode[] = [
      { id: 'a', type: 'aws:ec2', label: 'A', status: 'running', region: 'us-east-1', metadata: {} }
    ]
    const delta = computeDelta(prev, next)
    expect(delta.added).toHaveLength(1)
    expect(delta.added[0].id).toBe('a')
  })

  it('detects removed nodes', () => {
    const prev: CloudNode[] = [
      { id: 'a', type: 'aws:ec2', label: 'A', status: 'running', region: 'us-east-1', metadata: {} }
    ]
    const next: CloudNode[] = []
    const delta = computeDelta(prev, next)
    expect(delta.removed).toHaveLength(1)
    expect(delta.removed[0]).toBe('a')
  })

  it('detects status changes', () => {
    const prev: CloudNode[] = [
      { id: 'a', type: 'aws:ec2', label: 'A', status: 'running', region: 'us-east-1', metadata: {} }
    ]
    const next: CloudNode[] = [
      { id: 'a', type: 'aws:ec2', label: 'A', status: 'stopped', region: 'us-east-1', metadata: {} }
    ]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
  })

  it('marks node as changed when metadata differs', () => {
    const prev: CloudNode[] = [
      {
        id: 'a',
        type: 'aws:ec2',
        label: 'A',
        status: 'running',
        region: 'us-east-1',
        metadata: { instanceType: 't3.micro' }
      }
    ]
    const next: CloudNode[] = [
      {
        id: 'a',
        type: 'aws:ec2',
        label: 'A',
        status: 'running',
        region: 'us-east-1',
        metadata: { instanceType: 't3.large' }
      }
    ]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].metadata).toEqual({ instanceType: 't3.large' })
  })
})

describe('historyFilePath — path traversal defense (RIFT-128)', () => {
  it('returns a path under the history root for a normal ARN', () => {
    const p = historyFilePath('arn:aws:s3:::my-bucket')
    expect(p).toContain('/tmp/riftview-test/history/')
    expect(p).toMatch(/\.json$/)
  })

  it('sanitizes path-traversal segments', () => {
    const p = historyFilePath('../../etc/passwd')
    expect(p).toContain('/tmp/riftview-test/history/')
    expect(p).not.toContain('..')
  })

  it('sanitizes null bytes', () => {
    const p = historyFilePath('node\x00id')
    expect(p).toContain('/tmp/riftview-test/history/')
    expect(p).not.toContain('\x00')
  })

  it('handles colons in ARNs (keeps them)', () => {
    const p = historyFilePath('arn:aws:ec2:us-east-1:123456789012:instance/i-abc')
    expect(p).toContain('/tmp/riftview-test/history/')
    expect(p).toMatch(/\.json$/)
  })

  it('produces unique filenames for distinct node IDs', () => {
    const a = historyFilePath('arn:aws:s3:::bucket-a')
    const b = historyFilePath('arn:aws:s3:::bucket-b')
    expect(a).not.toBe(b)
  })
})
