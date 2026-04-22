/**
 * Runtime .meta.json allowlist — amendment (b) of RIF-20 sign-off 2026-04-21.
 *
 * A deliberately-polluted meta object must fail the check.
 * A clean meta object must pass.
 * Lints can be bypassed; this runtime check cannot.
 */

import { describe, it, expect } from 'vitest'
import { MetaAllowlistViolation, validateMetaJson } from '../../../src/main/restore/metaAllowlist'

const CLEAN_META = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  createdAt: '2026-04-20T12:00:00Z',
  profile: 'default',
  region: 'us-east-1',
  versionCount: 3,
  schemaVersion: 1
}

describe('metaAllowlist — validateMetaJson', () => {
  it('passes a clean meta object with all allowed keys', () => {
    expect(() => validateMetaJson(CLEAN_META)).not.toThrow()
  })

  it('passes a partial clean meta object (subset of allowed keys)', () => {
    expect(() => validateMetaJson({ id: 'abc', region: 'us-west-2' })).not.toThrow()
  })

  it('rejects an extra key not in the allowlist', () => {
    const polluted = { ...CLEAN_META, accountId: '123456789012' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
    expect(() => validateMetaJson(polluted)).toThrow("key 'accountId' not in allowlist")
  })

  it('rejects a key named "arn"', () => {
    const polluted = { ...CLEAN_META, arn: 'arn:aws:iam::123456789012:user/alice' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
  })

  it('rejects a value containing an ARN pattern', () => {
    const polluted = { ...CLEAN_META, profile: 'arn:aws:iam::123456789012:role/Admin' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
    expect(() => validateMetaJson(polluted)).toThrow('arn:aws:')
  })

  it('rejects a value containing an AKIA key', () => {
    const polluted = { ...CLEAN_META, profile: 'AKIAIOSFODNN7EXAMPLE' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
  })

  it('rejects a value containing a 12-digit account ID', () => {
    // The pattern \b\d{12}\b should catch bare 12-digit numbers.
    const polluted = { ...CLEAN_META, profile: '123456789012' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
  })

  it('rejects a value containing an EC2 instance ID', () => {
    const polluted = { ...CLEAN_META, profile: 'i-0a1b2c3d4e5f67890' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
  })

  it('rejects a value containing a VPC ID', () => {
    const polluted = { ...CLEAN_META, profile: 'vpc-0a1b2c3d4e5f67890' }
    expect(() => validateMetaJson(polluted)).toThrow(MetaAllowlistViolation)
  })

  it('MetaAllowlistViolation has the correct name', () => {
    try {
      validateMetaJson({ ...CLEAN_META, bad: 'value' })
    } catch (err) {
      expect(err).toBeInstanceOf(MetaAllowlistViolation)
      expect((err as MetaAllowlistViolation).name).toBe('MetaAllowlistViolation')
    }
  })
})
