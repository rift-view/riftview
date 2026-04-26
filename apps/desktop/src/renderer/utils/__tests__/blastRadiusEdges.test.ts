import { describe, it, expect } from 'vitest'
import { applyBlastRadiusToEdges } from '../blastRadiusEdges'
import { buildBlastRadius } from '@riftview/shared'
import type { CloudNode } from '@riftview/shared'

function makeNode(
  id: string,
  integrations?: { targetId: string; edgeType: 'trigger' | 'origin' | 'subscription' }[]
): CloudNode {
  return {
    id,
    type: 'aws:lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations: integrations ?? []
  }
}

describe('applyBlastRadiusToEdges', () => {
  it('returns edges unchanged when blastRadius is null', () => {
    const edges = [{ source: 'A', target: 'B', style: { stroke: 'red' } }]
    expect(applyBlastRadiusToEdges(edges, null)).toEqual(edges)
  })

  it('highlights edges where both endpoints are members without overriding native color', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    const edges: {
      source: string
      target: string
      style?: Record<string, unknown>
      animated?: boolean
    }[] = [{ source: 'A', target: 'B', style: { stroke: '#6366f1' } }]
    const result = applyBlastRadiusToEdges(edges, blast)
    expect(result[0].style?.stroke).toBe('#6366f1')
    expect(result[0].style?.strokeWidth).toBe(2.5)
    expect(result[0].style?.opacity).toBe(1)
  })

  it('dims edges where either endpoint is NOT a member', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
    const edges: {
      source: string
      target: string
      style?: Record<string, unknown>
      animated?: boolean
    }[] = [{ source: 'C', target: 'D' }]
    const result = applyBlastRadiusToEdges(edges, blast)
    expect(result[0].style?.opacity).toBe(0)
    expect(result[0].style?.pointerEvents).toBe('none')
    expect(result[0].animated).toBe(false)
  })

  it('dims edges where only one endpoint is a member (boundary case)', () => {
    const nodes = [makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]), makeNode('B')]
    const blast = buildBlastRadius(nodes, 'A')
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
