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
  it('returns no guardrails advisory when the chain is fully guarded (lambda has timeout, rds has no replica)', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', 30, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')).toHaveLength(0)
  })

  it('returns no guardrails advisory when RDS has multiAZ: true even with no-timeout lambda', () => {
    const rds = makeRds('rds-1', { multiAZ: true })
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')).toHaveLength(0)
  })

  it('returns no guardrails advisory when RDS has readReplicaCount > 0 even with no-timeout lambda', () => {
    const rds = makeRds('rds-1', { readReplicaCount: 1 })
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')).toHaveLength(0)
  })

  it('fires advisory for APIGW → Lambda(no timeout) → RDS(no replica, no multiAZ)', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    const advisory = result.find((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')
    expect(advisory).toBeDefined()
    expect(advisory!.ruleId).toBe('apigw-lambda-rds-no-guardrails')
    expect(advisory!.severity).toBe('critical')
    expect(advisory!.nodeId).toBe('apigw-1')
  })

  it('fires advisory when lambda timeout is 0 (treated as no timeout)', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', 0, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda, rds])
    const guardrailsAdvisories = result.filter((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')
    expect(guardrailsAdvisories).toHaveLength(1)
    expect(guardrailsAdvisories[0].ruleId).toBe('apigw-lambda-rds-no-guardrails')
  })

  it('returns empty array for an empty node list', () => {
    expect(analyzeGraph([])).toEqual([])
  })

  it('does not fire when there is no APIGW in the graph', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    expect(analyzeGraph([lambda, rds]).filter((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')).toHaveLength(0)
  })

  it('does not fire when APIGW has no integrations', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [])
    expect(analyzeGraph([apigw, lambda, rds]).filter((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')).toHaveLength(0)
  })

  it('advisory title mentions the chain', () => {
    const rds = makeRds('rds-1')
    const lambda = makeLambda('lambda-1', undefined, [{ targetId: 'rds-1', edgeType: 'trigger' }])
    const apigw = makeApigw('apigw-1', [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const advisory = analyzeGraph([apigw, lambda, rds]).find((a) => a.ruleId === 'apigw-lambda-rds-no-guardrails')
    expect(advisory).toBeDefined()
    expect(advisory!.title).toBe('Unguarded API→Lambda→RDS chain')
    expect(advisory!.detail).toContain('My API')
    expect(advisory!.detail).toContain('My Function')
    expect(advisory!.detail).toContain('My DB')
  })
})

// ── Helpers for new advisories ────────────────────────────────────────────────

function makeApigwWithThrottling(
  id = 'apigw-1',
  throttlingBurstLimit: number | undefined,
  integrations: CloudNode['integrations'] = [],
): CloudNode {
  return {
    id,
    type: 'apigw',
    label: 'My API',
    status: 'running',
    region: 'us-east-1',
    metadata: throttlingBurstLimit !== undefined ? { throttlingBurstLimit } : {},
    integrations,
  }
}

function makeLambdaWithConcurrency(
  id = 'lambda-1',
  reservedConcurrentExecutions: number | null | undefined,
  integrations: CloudNode['integrations'] = [],
): CloudNode {
  return {
    id,
    type: 'lambda',
    label: 'My Function',
    status: 'running',
    region: 'us-east-1',
    metadata:
      reservedConcurrentExecutions !== undefined
        ? { reservedConcurrentExecutions }
        : {},
    integrations,
  }
}

function makeSqs(id = 'sqs-1', hasDlq = false, integrations: CloudNode['integrations'] = []): CloudNode {
  return {
    id,
    type: 'sqs',
    label: 'My Queue',
    status: 'running',
    region: 'us-east-1',
    metadata: { hasDlq },
    integrations,
  }
}

function makeSns(id = 'sns-1', integrations: CloudNode['integrations'] = []): CloudNode {
  return {
    id,
    type: 'sns',
    label: 'My Topic',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    integrations,
  }
}

// ── Advisory: apigw-lambda-no-concurrency-limit ───────────────────────────────

describe('analyzeGraph — apigw-lambda-no-concurrency-limit', () => {
  it('fires when APIGW has no throttlingBurstLimit and Lambda has reservedConcurrentExecutions=null (scanner fetched, no limit)', () => {
    const lambda = makeLambdaWithConcurrency('lambda-1', null)
    const apigw = makeApigwWithThrottling('apigw-1', undefined, [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda])
    const advisory = result.find((a) => a.ruleId === 'apigw-lambda-no-concurrency-limit')
    expect(advisory).toBeDefined()
    expect(advisory!.severity).toBe('critical')
    expect(advisory!.nodeId).toBe('apigw-1')
  })

  it('does NOT fire when reservedConcurrentExecutions is undefined (scanner did not fetch)', () => {
    const lambda = makeLambdaWithConcurrency('lambda-1', undefined)
    const apigw = makeApigwWithThrottling('apigw-1', undefined, [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-no-concurrency-limit')).toHaveLength(0)
  })

  it('does NOT fire when APIGW has throttlingBurstLimit set', () => {
    const lambda = makeLambdaWithConcurrency('lambda-1', null)
    const apigw = makeApigwWithThrottling('apigw-1', 1000, [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-no-concurrency-limit')).toHaveLength(0)
  })

  it('does NOT fire when Lambda has reservedConcurrentExecutions set to a positive number', () => {
    const lambda = makeLambdaWithConcurrency('lambda-1', 100)
    const apigw = makeApigwWithThrottling('apigw-1', undefined, [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-no-concurrency-limit')).toHaveLength(0)
  })

  it('does NOT fire when Lambda has reservedConcurrentExecutions = 0 (explicitly throttled to zero)', () => {
    const lambda = makeLambdaWithConcurrency('lambda-1', 0)
    const apigw = makeApigwWithThrottling('apigw-1', undefined, [{ targetId: 'lambda-1', edgeType: 'trigger' }])

    const result = analyzeGraph([apigw, lambda])
    expect(result.filter((a) => a.ruleId === 'apigw-lambda-no-concurrency-limit')).toHaveLength(0)
  })
})

// ── Advisory: lambda-sqs-no-dlq ───────────────────────────────────────────────

describe('analyzeGraph — lambda-sqs-no-dlq', () => {
  it('fires when Lambda integration points to SQS with no DLQ', () => {
    const sqs = makeSqs('sqs-1', false)
    const lambda: CloudNode = {
      id: 'lambda-1',
      type: 'lambda',
      label: 'My Function',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
      integrations: [{ targetId: 'sqs-1', edgeType: 'trigger' }],
    }

    const result = analyzeGraph([lambda, sqs])
    const advisory = result.find((a) => a.ruleId === 'lambda-sqs-no-dlq')
    expect(advisory).toBeDefined()
    expect(advisory!.severity).toBe('warning')
    expect(advisory!.nodeId).toBe('lambda-1')
    expect(advisory!.detail).toContain('My Function')
    expect(advisory!.detail).toContain('My Queue')
  })

  it('does NOT fire when SQS has a DLQ', () => {
    const sqs = makeSqs('sqs-1', true)
    const lambda: CloudNode = {
      id: 'lambda-1',
      type: 'lambda',
      label: 'My Function',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
      integrations: [{ targetId: 'sqs-1', edgeType: 'trigger' }],
    }

    const result = analyzeGraph([lambda, sqs])
    expect(result.filter((a) => a.ruleId === 'lambda-sqs-no-dlq')).toHaveLength(0)
  })
})

// ── Advisory: sns-sqs-lambda-no-dlq ──────────────────────────────────────────

describe('analyzeGraph — sns-sqs-lambda-no-dlq', () => {
  it('fires when full SNS→SQS→Lambda chain has no DLQ on SQS', () => {
    const lambda: CloudNode = {
      id: 'lambda-1',
      type: 'lambda',
      label: 'My Function',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
    }
    const sqs = makeSqs('sqs-1', false, [{ targetId: 'lambda-1', edgeType: 'trigger' }])
    const sns = makeSns('sns-1', [{ targetId: 'sqs-1', edgeType: 'trigger' }])

    const result = analyzeGraph([sns, sqs, lambda])
    const advisory = result.find((a) => a.ruleId === 'sns-sqs-lambda-no-dlq')
    expect(advisory).toBeDefined()
    expect(advisory!.severity).toBe('warning')
    expect(advisory!.nodeId).toBe('sns-1')
    expect(advisory!.detail).toContain('My Topic')
    expect(advisory!.detail).toContain('My Queue')
    expect(advisory!.detail).toContain('My Function')
  })

  it('does NOT fire when SQS has a DLQ', () => {
    const lambda: CloudNode = {
      id: 'lambda-1',
      type: 'lambda',
      label: 'My Function',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
    }
    const sqs = makeSqs('sqs-1', true, [{ targetId: 'lambda-1', edgeType: 'trigger' }])
    const sns = makeSns('sns-1', [{ targetId: 'sqs-1', edgeType: 'trigger' }])

    const result = analyzeGraph([sns, sqs, lambda])
    expect(result.filter((a) => a.ruleId === 'sns-sqs-lambda-no-dlq')).toHaveLength(0)
  })
})
