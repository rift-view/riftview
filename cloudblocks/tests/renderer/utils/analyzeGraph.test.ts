import { describe, it, expect } from 'vitest'
import { analyzeGraph } from '../../../src/renderer/utils/analyzeGraph'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeApigw(id = 'apigw-1', integrations: CloudNode['integrations'] = []): CloudNode {
  return {
    id,
    type: 'apigw',
    label: 'My API',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations,
  }
}

function makeLambda(
  id = 'lambda-1',
  timeout: number | undefined,
  integrations: CloudNode['integrations'] = [],
): CloudNode {
  return {
    id,
    type: 'lambda',
    label: 'My Function',
    status: 'running',
    region: 'us-east-1',
    metadata: timeout !== undefined ? { timeout } : {},
    integrations,
  }
}

function makeRds(id = 'rds-1', opts: { multiAZ?: boolean; readReplicaCount?: number } = {}): CloudNode {
  return {
    id,
    type: 'rds',
    label: 'My DB',
    status: 'running',
    region: 'us-east-1',
    metadata: {
      ...(opts.multiAZ !== undefined ? { multiAZ: opts.multiAZ } : {}),
      ...(opts.readReplicaCount !== undefined ? { readReplicaCount: opts.readReplicaCount } : {}),
    },
  }
}

describe('analyzeGraph — apigw-lambda-rds-no-guardrails', () => {
  it('returns no advisory when the chain is fully guarded (lambda has timeout, rds has no replica)', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', 30, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result).toHaveLength(0)
  })

  it('returns no advisory when RDS has multiAZ: true even with no-timeout lambda', () => {
    const rds = makeRds('rds-1', { multiAZ: true })
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result).toHaveLength(0)
  })

  it('returns no advisory when RDS has readReplicaCount > 0 even with no-timeout lambda', () => {
    const rds = makeRds('rds-1', { readReplicaCount: 1 })
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result).toHaveLength(0)
  })

  it('fires advisory for APIGW → Lambda(no timeout) → RDS(no replica, no multiAZ)', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result).toHaveLength(1)
    expect(result[0].ruleId).toBe('apigw-lambda-rds-no-guardrails')
    expect(result[0].severity).toBe('critical')
    expect(result[0].nodeId).toBe('apigw-1')
  })

  it('fires advisory when lambda timeout is 0 (treated as no timeout)', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', 0, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result).toHaveLength(1)
    expect(result[0].ruleId).toBe('apigw-lambda-rds-no-guardrails')
  })

  it('returns empty array for an empty node list', () => {
    expect(analyzeGraph([])).toEqual([])
  })

  it('does not fire when there is no APIGW in the graph', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    expect(analyzeGraph([lambda, rds])).toHaveLength(0)
  })

  it('does not fire when APIGW has no integrations', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [])
    expect(analyzeGraph([apigw, lambda, rds])).toHaveLength(0)
  })

  it('advisory title mentions the chain', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const [advisory] = analyzeGraph([apigw, lambda, rds])
    expect(advisory.title).toBe('Unguarded API→Lambda→RDS chain')
    expect(advisory.detail).toContain('My API')
    expect(advisory.detail).toContain('My Function')
    expect(advisory.detail).toContain('My DB')
  })
})
