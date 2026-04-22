/**
 * In-memory plan token store with 5-minute TTL.
 *
 * Maps opaque plan tokens (256-bit hex) to held plan state. The renderer
 * never sees the canonical plan — only a signed projection. Tokens are:
 *   - single-use (evicted on RESTORE_APPLY)
 *   - TTL-evicted after 5 minutes
 *   - cleared entirely on app quit (no persistence)
 *
 * Spec: §4.1 Plan Tokens, RIF-20 sign-off 2026-04-21
 */

import { randomBytes, createHash } from 'node:crypto'
import type { RestorePlan } from '../plugin/restoreTypes'

const PLAN_TTL_MS = 5 * 60 * 1000

export interface PlanEntry {
  planToken: string
  planHash: string
  createdAt: number
  snapshotId: string
  versionId: string
  plan: RestorePlan
}

const _store = new Map<string, PlanEntry>()

/** Mint a new 256-bit plan token and store the plan entry. */
export function mintPlanToken(snapshotId: string, versionId: string, plan: RestorePlan): string {
  evictExpired()
  const token = randomBytes(32).toString('hex')
  const planHash = createHash('sha256').update(JSON.stringify(plan)).digest('hex')
  _store.set(token, {
    planToken: token,
    planHash,
    createdAt: Date.now(),
    snapshotId,
    versionId,
    plan
  })
  return token
}

/** Look up a plan token; returns undefined if absent or expired. */
export function lookupPlanToken(token: string): PlanEntry | undefined {
  evictExpired()
  return _store.get(token)
}

/** Consume a plan token (single-use). Returns the entry or undefined if absent/expired. */
export function consumePlanToken(token: string): PlanEntry | undefined {
  const entry = lookupPlanToken(token)
  if (entry) _store.delete(token)
  return entry
}

/** Evict all entries whose TTL has elapsed. */
function evictExpired(): void {
  const now = Date.now()
  for (const [token, entry] of _store) {
    if (now - entry.createdAt > PLAN_TTL_MS) {
      _store.delete(token)
    }
  }
}

/** Clear all entries — called at test teardown only. */
export function _clearForTest(): void {
  _store.clear()
}
