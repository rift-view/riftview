/**
 * Cost-delta preview (RIF-21).
 *
 * Pure function that turns a RIF-18 RestorePlan into a structured CostDelta.
 * The operator sees this before they click Apply — the $45/mo NAT Gateway
 * silently coming back to life must not be a surprise.
 *
 * This is a preview, not an invoice. Confidence is always reported alongside
 * the numbers.
 *
 * Spec: docs/superpowers/specs/2026-04-20-snapshot-export-cost-model.md
 */

import type { CostDelta, CostDeltaEntry, RestorePlan, RestoreStep } from '@riftview/cloud-scan'
import defaults from './defaults.json'

type ConfidenceTier = 'exact' | 'estimate' | 'unknown'

interface RegionRate {
  readonly shapeMonthlyUsd: number
  readonly confidence: ConfidenceTier
}

interface RateTable {
  readonly schemaVersion: number
  readonly generatedAt: string
  readonly source: string
  readonly rates: Record<string, Record<string, RegionRate>>
}

const DEFAULTS = defaults as RateTable

const EMPTY_ENTRY: CostDeltaEntry = {
  currency: 'USD',
  oneTime: 0,
  recurringMonthly: 0,
  confidence: 'exact'
}

function lookupRate(nodeType: string, region: string): RegionRate | null {
  const forType = DEFAULTS.rates[nodeType]
  if (!forType) return null
  return forType[region] ?? null
}

/** 'exact' → 'estimate' → 'unknown' — aggregate takes the weakest of its parts. */
function weaken(a: ConfidenceTier, b: ConfidenceTier): ConfidenceTier {
  if (a === 'unknown' || b === 'unknown') return 'unknown'
  if (a === 'estimate' || b === 'estimate') return 'estimate'
  return 'exact'
}

function sign(op: RestoreStep['op']): 1 | -1 | 0 {
  if (op === 'create') return 1
  if (op === 'destroy') return -1
  return 0 // update: unresolvable without before/after node config
}

export function costForStep(step: RestoreStep): CostDeltaEntry {
  const rate = lookupRate(step.targetNode.type, step.targetNode.region)
  const multiplier = sign(step.op)

  if (!rate) {
    return {
      currency: 'USD',
      oneTime: 0,
      recurringMonthly: 0,
      confidence: 'unknown',
      notes: [
        `No bundled rate for NodeType="${step.targetNode.type}" region="${step.targetNode.region}" — cost modeled as $0. Estimate may be low.`
      ]
    }
  }

  if (multiplier === 0) {
    return {
      currency: 'USD',
      oneTime: 0,
      recurringMonthly: 0,
      confidence: rate.confidence,
      notes: ['Update step — cost delta not modeled in v1 (requires before/after config diff).']
    }
  }

  return {
    currency: 'USD',
    oneTime: 0,
    recurringMonthly: Number((rate.shapeMonthlyUsd * multiplier).toFixed(2)),
    confidence: rate.confidence
  }
}

export function computeCostDelta(plan: RestorePlan): CostDelta {
  const perStep: Record<string, CostDeltaEntry> = {}
  let aggOneTime = 0
  let aggRecurring = 0
  let aggConfidence: ConfidenceTier = 'exact'
  const aggNotes: string[] = []

  for (const step of plan.steps) {
    const entry = costForStep(step)
    perStep[step.stepId] = entry
    aggOneTime += entry.oneTime
    aggRecurring += entry.recurringMonthly
    aggConfidence = weaken(aggConfidence, entry.confidence)
    if (entry.notes) for (const n of entry.notes) aggNotes.push(n)
  }

  if (plan.steps.length === 0) {
    return { planId: plan.planId, perStep, aggregate: EMPTY_ENTRY }
  }

  const aggregate: CostDeltaEntry = {
    currency: 'USD',
    oneTime: Number(aggOneTime.toFixed(2)),
    recurringMonthly: Number(aggRecurring.toFixed(2)),
    confidence: aggConfidence,
    ...(aggNotes.length > 0 ? { notes: aggNotes.slice(0, 10) } : {})
  }

  return { planId: plan.planId, perStep, aggregate }
}

/** Exposed for tests + future Settings surface (RIF-21 §9). */
export function pricingSourceDate(): string {
  return DEFAULTS.generatedAt
}

export function coveredNodeTypes(): readonly string[] {
  return Object.keys(DEFAULTS.rates)
}
