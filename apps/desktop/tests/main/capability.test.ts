import { describe, expect, it } from 'vitest'
import { DEMO_MODE_ENV_VAR, isDemoMode } from '../../src/main/capability'

describe('main/capability — isDemoMode', () => {
  it('exposes the env var name RIFTVIEW_DEMO_MODE (not VITE_*)', () => {
    expect(DEMO_MODE_ENV_VAR).toBe('RIFTVIEW_DEMO_MODE')
    expect(DEMO_MODE_ENV_VAR.startsWith('VITE_')).toBe(false)
  })

  it('returns false when the env var is unset', () => {
    expect(isDemoMode({})).toBe(false)
  })

  it('returns false when the env var is explicitly empty', () => {
    expect(isDemoMode({ RIFTVIEW_DEMO_MODE: '' })).toBe(false)
  })

  it('returns true for canonical truthy values', () => {
    for (const v of ['1', 'true', 'yes', 'on']) {
      expect(isDemoMode({ RIFTVIEW_DEMO_MODE: v })).toBe(true)
    }
  })

  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(isDemoMode({ RIFTVIEW_DEMO_MODE: 'TRUE' })).toBe(true)
    expect(isDemoMode({ RIFTVIEW_DEMO_MODE: 'Yes' })).toBe(true)
    expect(isDemoMode({ RIFTVIEW_DEMO_MODE: '  1  ' })).toBe(true)
  })

  it('returns false for non-truthy values (fail-closed)', () => {
    for (const v of ['0', 'false', 'no', 'off', 'demo', 'bogus']) {
      expect(isDemoMode({ RIFTVIEW_DEMO_MODE: v })).toBe(false)
    }
  })

  it('does not consult VITE_DEMO_MODE — renderer flag cannot enable main demo mode', () => {
    expect(isDemoMode({ VITE_DEMO_MODE: '1' } as NodeJS.ProcessEnv)).toBe(false)
  })

  it('defaults to process.env when no env passed (smoke — must not throw)', () => {
    expect(() => isDemoMode()).not.toThrow()
  })
})
