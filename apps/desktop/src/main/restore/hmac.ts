/**
 * HMAC-SHA256 helpers for the signed plan projection.
 *
 * RESTORE_PLAN returns { destructiveIds, hmac } where:
 *   hmac = HMAC-SHA256(mainSessionKey, canonicalJSON({ planToken, destructiveIds }))
 *
 * RESTORE_CONFIRM_STEP and RESTORE_APPLY must call verifyPlanProjection before
 * doing any work, so a tampered projection is rejected at the main-process level.
 *
 * Spec: §3c-T3 structural control, amendment (a) of RIF-20 sign-off 2026-04-21
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getMainSessionKey } from './sessionKey'

function canonicalJSON(planToken: string, destructiveIds: string[]): string {
  const sorted = [...destructiveIds].sort()
  return JSON.stringify({ destructiveIds: sorted, planToken })
}

export function signPlanProjection(planToken: string, destructiveIds: string[]): string {
  const payload = canonicalJSON(planToken, destructiveIds)
  return createHmac('sha256', getMainSessionKey()).update(payload).digest('hex')
}

export function verifyPlanProjection(
  planToken: string,
  destructiveIds: string[],
  providedHmac: string
): boolean {
  const expected = signPlanProjection(planToken, destructiveIds)
  // timing-safe comparison — both must be same length hex strings (64 chars)
  if (providedHmac.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(providedHmac, 'hex'))
  } catch {
    return false
  }
}
