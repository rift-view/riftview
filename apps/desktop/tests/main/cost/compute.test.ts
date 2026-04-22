import { describe, expect, it } from 'vitest'
import {
  computeCostDelta,
  costForStep,
  coveredNodeTypes,
  pricingSourceDate
} from '../../../src/main/cost/compute'
import type { RestorePlan, RestoreStep, StoredVersion } from '@riftview/cloud-scan'

const sampleVersion: StoredVersion = {
  versionId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  capturedAt: '2026-04-20T00:00:00Z',
  pluginId: 'com.riftview.aws',
  region: 'us-east-1',
  versionFormat: 'scan-snapshot'
}

function step(
  overrides: Partial<RestoreStep> & { targetType: string; op: RestoreStep['op']; region?: string }
): RestoreStep {
  const { targetType, region = 'us-east-1', op, ...rest } = overrides
  return {
    stepId: rest.stepId ?? `step-${Math.random().toString(36).slice(2, 8)}`,
    op,
    targetNode: { id: 'n1', type: targetType, label: 'n1', region },
    detail: {},
    destructive: op === 'destroy',
    ...rest
  }
}

function plan(steps: RestoreStep[]): RestorePlan {
  return {
    planId: 'p1',
    pluginId: 'com.riftview.aws',
    versionFormat: 'scan-snapshot',
    from: sampleVersion,
    to: 'live',
    steps,
    createdAt: '2026-04-20T00:00:00Z',
    planToken: 'token-abc'
  }
}

describe('cost/compute — RIF-21', () => {
  describe('costForStep', () => {
    it('create of a NAT Gateway in us-east-1 models +$32.85/mo recurring', () => {
      const e = costForStep(step({ targetType: 'nat-gateway', op: 'create' }))
      expect(e.recurringMonthly).toBe(32.85)
      expect(e.oneTime).toBe(0)
      expect(e.confidence).toBe('estimate')
      expect(e.currency).toBe('USD')
    })

    it('destroy of a NAT Gateway models -$32.85/mo (savings)', () => {
      const e = costForStep(step({ targetType: 'nat-gateway', op: 'destroy' }))
      expect(e.recurringMonthly).toBe(-32.85)
    })

    it('update is modeled as $0 with an explanatory note (v1 scope)', () => {
      const e = costForStep(step({ targetType: 'ec2', op: 'update' }))
      expect(e.recurringMonthly).toBe(0)
      expect(e.oneTime).toBe(0)
      expect(e.notes?.[0]).toMatch(/update step/i)
    })

    it('unknown NodeType returns confidence=unknown + "cost modeled as $0" note', () => {
      const e = costForStep(step({ targetType: 'bespoke-thing', op: 'create' }))
      expect(e.confidence).toBe('unknown')
      expect(e.recurringMonthly).toBe(0)
      expect(e.notes?.[0]).toMatch(/No bundled rate/)
    })

    it('unknown region for a known NodeType is also unknown + note', () => {
      const e = costForStep(step({ targetType: 'ec2', op: 'create', region: 'sa-east-1' }))
      expect(e.confidence).toBe('unknown')
      expect(e.notes?.[0]).toMatch(/sa-east-1/)
    })

    it('regional pricing differs — eu-west-1 NAT is more expensive than us-east-1', () => {
      const east = costForStep(step({ targetType: 'nat-gateway', op: 'create' }))
      const euw = costForStep(
        step({ targetType: 'nat-gateway', op: 'create', region: 'eu-west-1' })
      )
      expect(euw.recurringMonthly).toBeGreaterThan(east.recurringMonthly)
    })
  })

  describe('computeCostDelta', () => {
    it('empty plan → zero aggregate with exact confidence', () => {
      const cd = computeCostDelta(plan([]))
      expect(cd.aggregate.recurringMonthly).toBe(0)
      expect(cd.aggregate.oneTime).toBe(0)
      expect(cd.aggregate.confidence).toBe('exact')
      expect(cd.perStep).toEqual({})
    })

    it('keys perStep map by stepId', () => {
      const s1 = step({ stepId: 's1', targetType: 'nat-gateway', op: 'create' })
      const s2 = step({ stepId: 's2', targetType: 'ec2', op: 'create' })
      const cd = computeCostDelta(plan([s1, s2]))
      expect(Object.keys(cd.perStep).sort()).toEqual(['s1', 's2'])
    })

    it('aggregates recurringMonthly across steps', () => {
      const s1 = step({ stepId: 's1', targetType: 'nat-gateway', op: 'create' }) // +32.85
      const s2 = step({ stepId: 's2', targetType: 'ec2', op: 'create' }) // +7.5
      const s3 = step({ stepId: 's3', targetType: 'rds', op: 'destroy' }) // -17.4
      const cd = computeCostDelta(plan([s1, s2, s3]))
      // 32.85 + 7.5 - 17.4 = 22.95
      expect(cd.aggregate.recurringMonthly).toBe(22.95)
    })

    it('aggregate confidence is the weakest of per-step confidences', () => {
      const s1 = step({ stepId: 's1', targetType: 'nat-gateway', op: 'create' }) // estimate
      const s2 = step({ stepId: 's2', targetType: 'bespoke', op: 'create' }) // unknown
      const cd = computeCostDelta(plan([s1, s2]))
      expect(cd.aggregate.confidence).toBe('unknown')
    })

    it('collects step-level notes into aggregate.notes (capped at 10)', () => {
      const many = Array.from({ length: 12 }, (_, i) =>
        step({ stepId: `s${i}`, targetType: `unknown-${i}`, op: 'create' })
      )
      const cd = computeCostDelta(plan(many))
      expect(cd.aggregate.notes?.length ?? 0).toBeLessThanOrEqual(10)
    })

    it('planId flows through to the output', () => {
      const cd = computeCostDelta(plan([step({ targetType: 'ec2', op: 'create' })]))
      expect(cd.planId).toBe('p1')
    })

    it('NAT-Gateway hero case: restoring one NAT surfaces ~$32/mo, not silent zero', () => {
      const s1 = step({ stepId: 'nat-restore', targetType: 'nat-gateway', op: 'create' })
      const cd = computeCostDelta(plan([s1]))
      expect(cd.aggregate.recurringMonthly).toBeGreaterThan(30)
      expect(cd.aggregate.recurringMonthly).toBeLessThan(35)
    })
  })

  describe('meta', () => {
    it('pricingSourceDate returns the bundled table date', () => {
      expect(pricingSourceDate()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('coveredNodeTypes returns the priced set', () => {
      const types = coveredNodeTypes()
      expect(types).toContain('ec2')
      expect(types).toContain('nat-gateway')
      expect(types.length).toBeGreaterThan(0)
    })
  })
})
