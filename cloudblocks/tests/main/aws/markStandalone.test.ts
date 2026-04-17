import { describe, it, expect } from 'vitest'
import { markStandaloneNodes } from '../../../src/main/aws/markStandalone'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function n(id: string, type: CloudNode['type'] = 'lambda', integrations?: { targetId: string; edgeType: 'trigger' | 'origin' | 'subscription' }[]): CloudNode {
  return {
    id,
    label: id,
    type,
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations: integrations ?? [],
  }
}

describe('markStandaloneNodes', () => {
  it('marks isolated node as standalone', () => {
    const nodes = [n('solo')]
    markStandaloneNodes(nodes)
    expect(nodes[0].metadata.standalone).toBe(true)
  })

  it('marks node with outbound edge as NOT standalone', () => {
    const nodes = [n('A', 'lambda', [{ targetId: 'B', edgeType: 'trigger' }]), n('B')]
    markStandaloneNodes(nodes)
    expect(nodes[0].metadata.standalone).toBe(false)
  })

  it('marks node with only inbound edge as NOT standalone', () => {
    const nodes = [n('A', 'lambda', [{ targetId: 'B', edgeType: 'trigger' }]), n('B')]
    markStandaloneNodes(nodes)
    expect(nodes[1].metadata.standalone).toBe(false)
  })

  it('never marks container types standalone (vpc, subnet, security-group)', () => {
    const nodes: CloudNode[] = [
      n('vpc-1', 'vpc'),
      n('subnet-1', 'subnet'),
      n('sg-1', 'security-group'),
    ]
    markStandaloneNodes(nodes)
    for (const node of nodes) {
      expect(node.metadata.standalone).toBeUndefined()
    }
  })

  it('preserves existing metadata fields', () => {
    const nodes: CloudNode[] = [{ ...n('A'), metadata: { existing: 'value' } }]
    markStandaloneNodes(nodes)
    expect((nodes[0].metadata as Record<string, unknown>).existing).toBe('value')
    expect((nodes[0].metadata as Record<string, unknown>).standalone).toBe(true)
  })

  it('handles empty node array', () => {
    expect(() => markStandaloneNodes([])).not.toThrow()
  })

  it('returns the same array reference (for chaining)', () => {
    const nodes = [n('A')]
    const result = markStandaloneNodes(nodes)
    expect(result).toBe(nodes)
  })
})
