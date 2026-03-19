import { describe, it, expect } from 'vitest'
import { computeDelta } from '../scanner'
import type { CloudNode } from '../../../renderer/types/cloud'

describe('computeDelta', () => {
  it('returns empty delta for identical snapshots', () => {
    const nodes: CloudNode[] = [{
      id: 'a', type: 'ec2', label: 'A', status: 'running',
      region: 'us-east-1', metadata: {},
    }]
    const delta = computeDelta(nodes, nodes)
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('detects added nodes', () => {
    const prev: CloudNode[] = []
    const next: CloudNode[] = [{ id: 'a', type: 'ec2', label: 'A', status: 'running', region: 'us-east-1', metadata: {} }]
    const delta = computeDelta(prev, next)
    expect(delta.added).toHaveLength(1)
    expect(delta.added[0].id).toBe('a')
  })

  it('detects removed nodes', () => {
    const prev: CloudNode[] = [{ id: 'a', type: 'ec2', label: 'A', status: 'running', region: 'us-east-1', metadata: {} }]
    const next: CloudNode[] = []
    const delta = computeDelta(prev, next)
    expect(delta.removed).toHaveLength(1)
    expect(delta.removed[0]).toBe('a')
  })

  it('detects status changes', () => {
    const prev: CloudNode[] = [{ id: 'a', type: 'ec2', label: 'A', status: 'running', region: 'us-east-1', metadata: {} }]
    const next: CloudNode[] = [{ id: 'a', type: 'ec2', label: 'A', status: 'stopped', region: 'us-east-1', metadata: {} }]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
  })

  it('marks node as changed when metadata differs', () => {
    const prev: CloudNode[] = [{
      id: 'a', type: 'ec2', label: 'A', status: 'running',
      region: 'us-east-1', metadata: { instanceType: 't3.micro' },
    }]
    const next: CloudNode[] = [{
      id: 'a', type: 'ec2', label: 'A', status: 'running',
      region: 'us-east-1', metadata: { instanceType: 't3.large' },
    }]
    const delta = computeDelta(prev, next)
    expect(delta.changed).toHaveLength(1)
    expect(delta.changed[0].metadata).toEqual({ instanceType: 't3.large' })
  })
})
