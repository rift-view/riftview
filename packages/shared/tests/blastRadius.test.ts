import { describe, it, expect } from 'vitest'
import { buildBlastRadius } from '../src/graph/blastRadius'
import type { CloudNode } from '../src/types/cloud'

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
    const nodes = [
      makeNode('A', [{ targetId: 'B', edgeType: 'trigger' }]),
      makeNode('B', [{ targetId: 'C', edgeType: 'trigger' }]),
      makeNode('C', [{ targetId: 'B', edgeType: 'trigger' }])
    ]
    const result = buildBlastRadius(nodes, 'B')
    expect(result.members.get('A')?.direction).toBe('upstream')
    expect(result.members.get('C')?.direction).toBe('both')
  })

  it('resolves DNS-name targetIds (ALB case) to real node IDs in member set', () => {
    const apigw: CloudNode = {
      id: 'apigw-1',
      type: 'aws:apigw',
      label: 'api',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
      integrations: [{ targetId: 'my-alb.us-east-1.elb.amazonaws.com', edgeType: 'trigger' }]
    }
    const alb: CloudNode = {
      id: 'alb-1',
      type: 'aws:alb',
      label: 'alb',
      status: 'running',
      region: 'us-east-1',
      metadata: { dnsName: 'my-alb.us-east-1.elb.amazonaws.com' }
    }
    const result = buildBlastRadius([apigw, alb], 'apigw-1')
    expect(result.members.has('alb-1')).toBe(true)
    expect(result.members.has('my-alb.us-east-1.elb.amazonaws.com')).toBe(false)
    expect(result.members.get('alb-1')?.direction).toBe('downstream')
  })

  it('resolves targetIds on backward BFS too (upstream by resolved id)', () => {
    const lambda: CloudNode = {
      id: 'lambda-1',
      type: 'aws:lambda',
      label: 'fn',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
      integrations: [{ targetId: 'some-queue.sqs.amazonaws.com', edgeType: 'trigger' }]
    }
    const rds: CloudNode = {
      id: 'rds-1',
      type: 'aws:rds',
      label: 'db',
      status: 'running',
      region: 'us-east-1',
      metadata: { endpoint: 'some-queue.sqs.amazonaws.com' }
    }
    const result = buildBlastRadius([lambda, rds], 'rds-1')
    expect(result.members.has('lambda-1')).toBe(true)
    expect(result.members.get('lambda-1')?.direction).toBe('upstream')
  })

  it('upstreamCount and downstreamCount are correct', () => {
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
    expect(result.upstreamCount).toBe(1)
    expect(result.downstreamCount).toBe(2)
  })
})
