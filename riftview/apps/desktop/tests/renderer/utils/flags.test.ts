import { describe, it, expect, vi, afterEach } from 'vitest'
import { flag } from '../../../src/renderer/utils/flags'

describe('flag()', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when env var is not set', () => {
    vi.stubEnv('VITE_FLAG_COMMAND_BOARD', undefined)
    expect(flag('COMMAND_BOARD')).toBe(false)
  })

  it('returns true when env var is "true"', () => {
    vi.stubEnv('VITE_FLAG_COMMAND_BOARD', 'true')
    expect(flag('COMMAND_BOARD')).toBe(true)
  })

  it('returns false when env var is set to a non-"true" value', () => {
    vi.stubEnv('VITE_FLAG_COMMAND_BOARD', '1')
    expect(flag('COMMAND_BOARD')).toBe(false)
  })
})
