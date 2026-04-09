import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildCommandNodes, NODE_TIER } from '../../../../src/renderer/utils/commandLayout'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

function makeNode(type: CloudNode['type'], id = `id-${type}`): CloudNode {
  return { id, type, label: type, status: 'running', region: 'us-east-1', metadata: {} }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('NODE_TIER', () => {
  it('places lambda in tier 2', () => {
    expect(NODE_TIER['lambda']).toBe(2)
  })

  it('places rds in tier 3', () => {
    expect(NODE_TIER['rds']).toBe(3)
  })

  it('places sqs in tier 4', () => {
    expect(NODE_TIER['sqs']).toBe(4)
  })
})

describe('buildCommandNodes', () => {
  it('returns empty array for empty input', () => {
    expect(buildCommandNodes([])).toEqual([])
  })

  it('places lambda nodes as type "resource"', () => {
    const nodes = buildCommandNodes([makeNode('lambda')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(1)
  })

  it('includes a tier-label node for each occupied tier', () => {
    // lambda (tier 2) and rds (tier 3) → 2 tier labels
    const nodes = buildCommandNodes([makeNode('lambda'), makeNode('rds')])
    const tierLabels = nodes.filter(n => n.type === 'tier-label')
    expect(tierLabels).toHaveLength(2)
  })

  it('excludes vpc from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('vpc')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('excludes subnet from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('subnet')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('excludes security-group from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('security-group')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('excludes nat-gateway from output nodes', () => {
    const nodes = buildCommandNodes([makeNode('nat-gateway')])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    expect(resourceNodes).toHaveLength(0)
  })

  it('places unmapped type (unknown) in tier 6', () => {
    const nodes = buildCommandNodes([makeNode('unknown')])
    const tierLabels = nodes.filter(n => n.type === 'tier-label')
    // Tier 6 label should be present
    expect(tierLabels.some(n => (n.data as { name: string }).name === 'Other')).toBe(true)
  })

  it('tier-label nodes have draggable: false', () => {
    const nodes = buildCommandNodes([makeNode('lambda')])
    const tierLabel = nodes.find(n => n.type === 'tier-label')
    expect(tierLabel?.draggable).toBe(false)
  })

  it('resource nodes are positioned in a grid within their tier', () => {
    const n1 = makeNode('lambda', 'lam-1')
    const n2 = makeNode('ec2', 'ec2-1')
    const nodes = buildCommandNodes([n1, n2])
    const resourceNodes = nodes.filter(n => n.type === 'resource')
    // Both in tier 2 — they should have different x positions
    expect(resourceNodes[0].position.x).not.toBe(resourceNodes[1].position.x)
  })
})
