// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeTidyLayout } from '../tidyLayout'
import type { CloudNode } from '../../types/cloud'

function makeNode(id: string, type: CloudNode['type'], opts: Partial<CloudNode> = {}): CloudNode {
  return {
    id,
    type,
    label:    id,
    status:   'running',
    region:   'us-east-1',
    metadata: {},
    ...opts,
  }
}

describe('computeTidyLayout', () => {
  it('returns positions for all nodes (graph view)', () => {
    const nodes = [
      makeNode('n1', 'ec2'),
      makeNode('n2', 's3'),
      makeNode('n3', 'lambda'),
    ]
    const positions = computeTidyLayout(nodes, 'graph')
    expect(Object.keys(positions)).toHaveLength(3)
    expect(positions['n1']).toBeDefined()
    expect(positions['n2']).toBeDefined()
    expect(positions['n3']).toBeDefined()
  })

  it('nodes of same type share the same y (grouped on same row)', () => {
    const nodes = [
      makeNode('e1', 'ec2'),
      makeNode('e2', 'ec2'),
      makeNode('s1', 's3'),
    ]
    const positions = computeTidyLayout(nodes, 'graph')
    // ec2 nodes should be in the same group (same row start y)
    expect(positions['e1'].y).toBe(positions['e2'].y)
  })

  it('positions are deterministic (same input → same output)', () => {
    const nodes = [
      makeNode('a', 'ec2'),
      makeNode('b', 's3'),
      makeNode('c', 'lambda'),
      makeNode('d', 'ec2'),
    ]
    const first  = computeTidyLayout(nodes, 'graph')
    const second = computeTidyLayout(nodes, 'graph')
    expect(first).toEqual(second)
  })

  it('topology view skips nodes with parentId', () => {
    const nodes = [
      makeNode('n1', 'ec2'),
      makeNode('n2', 'ec2', { parentId: 'vpc-1' }),
    ]
    const positions = computeTidyLayout(nodes, 'topology')
    expect(positions['n1']).toBeDefined()
    expect(positions['n2']).toBeUndefined()
  })

  it('topology view skips nodes with region === "global"', () => {
    const nodes = [
      makeNode('n1', 'ec2'),
      makeNode('n2', 'cloudfront', { region: 'global' }),
    ]
    const positions = computeTidyLayout(nodes, 'topology')
    expect(positions['n1']).toBeDefined()
    expect(positions['n2']).toBeUndefined()
  })

  it('empty input returns empty object', () => {
    const positions = computeTidyLayout([], 'graph')
    expect(positions).toEqual({})
  })
})
