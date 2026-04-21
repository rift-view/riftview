import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { redact, redactKeepSuffix, isDemoMode } from '../../../src/renderer/utils/demoMode'

/**
 * Demo mode is now a runtime flag exposed by the preload bridge as
 * `window.riftview.isDemoMode` (captured from process.env.RIFTVIEW_DEMO_MODE
 * at preload load). These tests stub that bridge directly.
 */
describe('demoMode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('when window.riftview.isDemoMode is false', () => {
    beforeEach(() => {
      vi.stubGlobal('riftview', { isDemoMode: false })
    })

    it('isDemoMode returns false', () => {
      expect(isDemoMode()).toBe(false)
    })

    it('redact is a no-op', () => {
      // Fake keys: structurally match the regex (AKIA + 16 chars) but are
      // obviously placeholders so GitHub secret-scanning doesn't flag them.
      const input = 'arn:aws:iam::123456789012:user/julius AKIAZZ1111ZZ2222ZZ33'
      expect(redact(input)).toBe(input)
    })

    it('redactKeepSuffix is a no-op', () => {
      expect(redactKeepSuffix('i-0abc1234')).toBe('i-0abc1234')
    })
  })

  describe('when window.riftview is absent (unit test without bridge)', () => {
    beforeEach(() => {
      vi.stubGlobal('riftview', undefined)
    })

    it('isDemoMode returns false', () => {
      expect(isDemoMode()).toBe(false)
    })

    it('redact is a no-op', () => {
      const input = 'arn:aws:iam::123456789012:user/julius'
      expect(redact(input)).toBe(input)
    })
  })

  describe('when window.riftview.isDemoMode is true', () => {
    beforeEach(() => {
      vi.stubGlobal('riftview', { isDemoMode: true })
    })

    it('isDemoMode returns true', () => {
      expect(isDemoMode()).toBe(true)
    })

    it('masks 12-digit account IDs', () => {
      expect(redact('arn:aws:iam::123456789012:user/julius')).toBe(
        'arn:aws:iam::************:user/julius'
      )
    })

    it('masks AKIA access keys', () => {
      // AKIAZZ1111ZZ2222ZZ33 = 20 chars, fits AKIA[0-9A-Z]{16} pattern.
      expect(redact('key=AKIAZZ1111ZZ2222ZZ33 value')).toBe('key=AKIA**************** value')
    })

    it('masks ASIA session keys', () => {
      expect(redact('ASIAZZ1111ZZ2222ZZ33')).toBe('ASIA****************')
    })

    it('masks IPv4 addresses', () => {
      expect(redact('Instance at 10.0.1.42 on the VPC')).toBe(
        'Instance at ***.***.***.*** on the VPC'
      )
    })

    it('masks long hex blobs (potential credentials)', () => {
      expect(redact('token=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6')).toBe('token=[redacted]')
    })

    it('leaves non-sensitive text untouched', () => {
      expect(redact('Lambda my-fn region us-east-1 status running')).toBe(
        'Lambda my-fn region us-east-1 status running'
      )
    })

    it('redactKeepSuffix preserves last 4 chars by default', () => {
      expect(redactKeepSuffix('i-0abc1234ef56')).toBe('**********ef56')
    })

    it('redactKeepSuffix masks fully when input shorter than suffix', () => {
      expect(redactKeepSuffix('abc')).toBe('***')
    })
  })
})
