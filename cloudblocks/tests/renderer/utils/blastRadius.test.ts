import { describe, it, expect } from 'vitest'
import { buildBlastRadius } from '../../../src/renderer/utils/blastRadius'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeNode(id: string, integrations?: { targetId: string; edgeType: 'trigger' | 'origin' | 'subscription' }[]): CloudNode {
  return {
    id,
    type:         'lambda',
    label:        id,
    status:       'running',
    region:       'us-east-1',
    metadata:     {},
    integrations: integrations ?? [],
  }
}

describe('buildBlastRadius', () => {
  it('direct neighbor — source with 1 integration target → target is hop 1 downstream', () => {
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B'),
    ]
    const result = buildBlastRadius(nodes, 'A')
    expect(result.members.get('A')?.hopDistance).toBe(0)
    expect(result.members.get('A')?.direction).toBe('source')
    expect(result.members.get('B')?.hopDistance).toBe(1)
    expect(result.members.get('B')?.direction).toBe('downstream')
  })

  it('multi-hop chain — A→B→C, click A → B is hop 1, C is hop 2', () => {
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B', [{ targetId: 'C', edgeType: 'trigger' }]),
      makeNode('C'),
    ]
    const result = buildBlastRadius(nodes, 'A')
    expect(result.members.get('B')?.hopDistance).toBe(1)
    expect(result.members.get('C')?.hopDistance).toBe(2)
    expect(result.members.get('C')?.direction).toBe('downstream')
  })

  it('backward traversal — A→B, click B → A is hop 1 upstream', () => {
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B'),
    ]
    const result = buildBlastRadius(nodes, 'B')
    expect(result.members.get('A')?.direction).toBe('upstream')
    expect(result.members.get('A')?.hopDistance).toBe(1)
    expect(result.members.get('B')?.direction).toBe('source')
  })

  it('cycle detection — A→B→A, no infinite loop, both in result', () => {
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B', [{ targetId: 'A', edgeType: 'trigger' }]),
    ]
    // Should not throw or hang
    const result = buildBlastRadius(nodes, 'A')
    expect(result.members.has('A')).toBe(true)
    expect(result.members.has('B')).toBe(true)
  })

  it('no integrations — node with empty integrations → only source in result', () => {
    const nodes = [
      makeNode('A'),
      makeNode('B'),
    ]
    const result = buildBlastRadius(nodes, 'A')
    expect(result.members.size).toBe(1)
    expect(result.members.get('A')?.direction).toBe('source')
    expect(result.members.has('B')).toBe(false)
  })

  it('direction "both" — A→B, C→B, B→C: click B → A is upstream, C is both', () => {
    // A→B:  A sends to B
    // C→B:  C sends to B
    // B→C:  B sends to C
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B', [{ targetId: 'C', edgeType: 'trigger' }]),
      makeNode('C', [{ targetId: 'B', edgeType: 'trigger' }]),
    ]
    const result = buildBlastRadius(nodes, 'B')
    // A only points TO B — upstream
    expect(result.members.get('A')?.direction).toBe('upstream')
    // C points TO B (upstream) and B points TO C (downstream) → 'both'
    expect(result.members.get('C')?.direction).toBe('both')
  })

  it('upstreamCount and downstreamCount are correct', () => {
    // X→A (upstream), A→Y (downstream), A→Z (downstream)
    const nodes = [
      makeNode('X', [{ targetId: 'A', edgeType: 'trigger' }]),
      makeNode('A', [
        { targetId: 'Y', edgeType: 'trigger' },
        { targetId: 'Z', edgeType: 'trigger' },
      ]),
      makeNode('Y'),
      makeNode('Z'),
    ]
    const result = buildBlastRadius(nodes, 'A')
    expect(result.upstreamCount).toBe(1)    // X
    expect(result.downstreamCount).toBe(2)  // Y + Z
  })
})
