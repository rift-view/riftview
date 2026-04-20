import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { redact, redactKeepSuffix, isDemoMode } from '../../../src/renderer/utils/demoMode'

describe('demoMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('when VITE_DEMO_MODE is off', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_DEMO_MODE', '')
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

  describe('when VITE_DEMO_MODE=1', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_DEMO_MODE', '1')
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

  describe('when VITE_DEMO_MODE=true', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_DEMO_MODE', 'true')
    })

    it('isDemoMode returns true', () => {
      expect(isDemoMode()).toBe(true)
    })
  })
})
