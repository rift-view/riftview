// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { computeTidyLayout } from '../../../src/renderer/utils/tidyLayout'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(id: string, type: CloudNode['type'], opts: Partial<CloudNode> = {}): CloudNode {
  return { id, type, label: id, status: 'running', region: 'us-east-1', metadata: {}, ...opts }
}

describe('computeTidyLayout — graph view', () => {
  it('returns empty object for empty input', () => {
    expect(computeTidyLayout([], 'graph')).toEqual({})
  })

  it('returns a position for a single node', () => {
    const pos = computeTidyLayout([node('a', 'ec2')], 'graph')
    expect(pos['a']).toBeDefined()
    expect(typeof pos['a'].x).toBe('number')
    expect(typeof pos['a'].y).toBe('number')
  })

  it('nodes of the same type share the same y (same group row)', () => {
    const nodes = [node('ec2-1', 'ec2'), node('ec2-2', 'ec2'), node('s3-1', 's3')]
    const pos = computeTidyLayout(nodes, 'graph')
    expect(pos['ec2-1'].y).toBe(pos['ec2-2'].y)
  })

  it('different types are placed in different x groups', () => {
    const nodes = [node('ec2-1', 'ec2'), node('s3-1', 's3')]
    const pos = computeTidyLayout(nodes, 'graph')
    expect(pos['ec2-1'].x).not.toBe(pos['s3-1'].x)
  })

  it('positions are deterministic — same input produces same output', () => {
    const nodes = [node('a', 'ec2'), node('b', 's3'), node('c', 'lambda')]
    expect(computeTidyLayout(nodes, 'graph')).toEqual(computeTidyLayout(nodes, 'graph'))
  })

  it('5 nodes of same type wraps into a second row (NODES_PER_ROW=4)', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => node(`ec2-${i}`, 'ec2'))
    const pos = computeTidyLayout(nodes, 'graph')
    // First 4 nodes share y, 5th is on a new row (higher y)
    expect(pos['ec2-4'].y).toBeGreaterThan(pos['ec2-0'].y)
  })
})

describe('computeTidyLayout — topology view', () => {
  it('returns empty object for empty input', () => {
    expect(computeTidyLayout([], 'topology')).toEqual({})
  })

  it('skips nodes with parentId', () => {
    const nodes = [node('vpc-1', 'vpc'), node('ec2-1', 'ec2', { parentId: 'subnet-1' })]
    const pos = computeTidyLayout(nodes, 'topology')
    expect('vpc-1' in pos).toBe(true)
    expect('ec2-1' in pos).toBe(false)
  })

  it('skips nodes with region === global', () => {
    const globalNode = node('cf-1', 'cloudfront', { region: 'global' })
    const pos = computeTidyLayout([globalNode], 'topology')
    expect('cf-1' in pos).toBe(false)
  })

  it('includes top-level non-global nodes', () => {
    const n = node('vpc-1', 'vpc')
    const pos = computeTidyLayout([n], 'topology')
    expect('vpc-1' in pos).toBe(true)
  })
})
