/**
 * HMAC-signed plan projection — amendment (a) of RIF-20 sign-off 2026-04-21.
 *
 * signPlanProjection produces an HMAC that verifyPlanProjection accepts.
 * A tampered destructiveIds or planToken must fail verification.
 * A forged HMAC must fail verification.
 */

import { describe, it, expect } from 'vitest'
import { signPlanProjection, verifyPlanProjection } from '../../../src/main/restore/hmac'

describe('restore/hmac — signPlanProjection / verifyPlanProjection', () => {
  const planToken = 'abc123deadbeef'
  const destructiveIds = ['i-0a1b2c3d', 'vpc-0e1f2a3b']

  it('produces a 64-char hex HMAC', () => {
    const hmac = signPlanProjection(planToken, destructiveIds)
    expect(hmac).toMatch(/^[0-9a-f]{64}$/)
  })

  it('verifies its own signature', () => {
    const hmac = signPlanProjection(planToken, destructiveIds)
    expect(verifyPlanProjection(planToken, destructiveIds, hmac)).toBe(true)
  })

  it('verification is order-independent on destructiveIds', () => {
    const hmac = signPlanProjection(planToken, destructiveIds)
    const reordered = [...destructiveIds].reverse()
    expect(verifyPlanProjection(planToken, reordered, hmac)).toBe(true)
  })

  it('fails when planToken is tampered', () => {
    const hmac = signPlanProjection(planToken, destructiveIds)
    expect(verifyPlanProjection('tampered-token', destructiveIds, hmac)).toBe(false)
  })

  it('fails when destructiveIds are tampered', () => {
    const hmac = signPlanProjection(planToken, destructiveIds)
    expect(verifyPlanProjection(planToken, ['i-forged'], hmac)).toBe(false)
  })

  it('fails when destructiveIds have an extra element', () => {
    const hmac = signPlanProjection(planToken, destructiveIds)
    expect(verifyPlanProjection(planToken, [...destructiveIds, 'extra'], hmac)).toBe(false)
  })

  it('fails on a forged HMAC (all-zeros)', () => {
    expect(verifyPlanProjection(planToken, destructiveIds, '0'.repeat(64))).toBe(false)
  })

  it('fails on a forged HMAC (wrong length)', () => {
    expect(verifyPlanProjection(planToken, destructiveIds, 'short')).toBe(false)
  })

  it('fails on an empty HMAC', () => {
    expect(verifyPlanProjection(planToken, destructiveIds, '')).toBe(false)
  })

  it('produces stable output for empty destructiveIds', () => {
    const hmac1 = signPlanProjection(planToken, [])
    const hmac2 = signPlanProjection(planToken, [])
    expect(hmac1).toBe(hmac2)
    expect(verifyPlanProjection(planToken, [], hmac1)).toBe(true)
  })
})
