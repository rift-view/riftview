import { describe, it, expect } from 'vitest'
import { buildBlastRadius, applyBlastRadiusToEdges } from '../../../src/renderer/utils/blastRadius'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeNode(
  id: string,
  integrations?: { targetId: string; edgeType: 'trigger' | 'origin' | 'subscription' }[]
): CloudNode {
  return {
    id,
    type: 'lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations: integrations ?? []
  }
}

describe('buildBlastRadius', () => {
  it('direct neighbor — source with 1 integration target → target is hop 1 downstream', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
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
      makeNode('C')
    ]
    const result = buildBlastRadius(nodes, 'A')
    expect(result.members.get('B')?.hopDistance).toBe(1)
    expect(result.members.get('C')?.hopDistance).toBe(2)
    expect(result.members.get('C')?.direction).toBe('downstream')
  })

  it('backward traversal — A→B, click B → A is hop 1 upstream', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const result = buildBlastRadius(nodes, 'B')
    expect(result.members.get('A')?.direction).toBe('upstream')
    expect(result.members.get('A')?.hopDistance).toBe(1)
    expect(result.members.get('B')?.direction).toBe('source')
  })

  it('cycle detection — A→B→A, no infinite loop, both in result', () => {
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B', [{ targetId: 'A', edgeType: 'trigger' }])
    ]
    // Should not throw or hang
    const result = buildBlastRadius(nodes, 'A')
    expect(result.members.has('A')).toBe(true)
    expect(result.members.has('B')).toBe(true)
  })

  it('no integrations — node with empty integrations → only source in result', () => {
    const nodes = [makeNode('A'), makeNode('B')]
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
      makeNode('C', [{ targetId: 'B', edgeType: 'trigger' }])
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
        { targetId: 'Z', edgeType: 'trigger' }
      ]),
      makeNode('Y'),
      makeNode('Z')
    ]
    const result = buildBlastRadius(nodes, 'A')
    expect(result.upstreamCount).toBe(1) // X
    expect(result.downstreamCount).toBe(2) // Y + Z
  })
})

describe('applyBlastRadiusToEdges', () => {
  it('returns edges unchanged when blastRadius is null', () => {
    const edges = [{ source: 'A', target: 'B', style: { stroke: 'red' } }]
    expect(applyBlastRadiusToEdges(edges, null)).toEqual(edges)
  })

  it('highlights edges where both endpoints are members', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    const edges: { source: string; target: string; style?: Record<string, unknown>; animated?: boolean }[] = [
      { source: 'A', target: 'B' }
    ]
    const result = applyBlastRadiusToEdges(edges, blast)
    expect(result[0].style?.stroke).toBe('#f59e0b')
    expect(result[0].style?.strokeWidth).toBe(2.5)
    expect(result[0].style?.opacity).toBe(1)
    expect(result[0].animated).toBe(true)
  })

  it('dims edges where either endpoint is NOT a member', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    // C is not in the blast radius
    const edges: { source: string; target: string; style?: Record<string, unknown>; animated?: boolean }[] = [
      { source: 'C', target: 'D' }
    ]
    const result = applyBlastRadiusToEdges(edges, blast)
    expect(result[0].style?.opacity).toBe(0)
    expect(result[0].style?.pointerEvents).toBe('none')
    expect(result[0].animated).toBe(false)
  })

  it('dims edges where only one endpoint is a member (boundary case)', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    // A is member, C is not
    const edges: { source: string; target: string; style?: Record<string, unknown> }[] = [
      { source: 'A', target: 'C' }
    ]
    const result = applyBlastRadiusToEdges(edges, blast)
    expect(result[0].style?.opacity).toBe(0)
  })

  it('preserves other style properties on member edges', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    const edges = [{ source: 'A', target: 'B', style: { strokeDasharray: '4 2' } }]
    const result = applyBlastRadiusToEdges(edges, blast)
    expect(result[0].style?.strokeDasharray).toBe('4 2')
  })

  it('does not mutate the input edges', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    const edges = [{ source: 'A', target: 'B' }]
    const original = JSON.stringify(edges)
    applyBlastRadiusToEdges(edges, blast)
    expect(JSON.stringify(edges)).toBe(original)
  })
})
