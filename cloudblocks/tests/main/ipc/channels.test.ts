import { describe, it, expect } from 'vitest'
import { IPC } from '../../../src/main/ipc/channels'

describe('IPC channel constants', () => {
  it('has required channel names', () => {
    expect(IPC.PROFILES_LIST).toBe('profiles:list')
    expect(IPC.SCAN_START).toBe('scan:start')
    expect(IPC.SCAN_DELTA).toBe('scan:delta')
    expect(IPC.SCAN_STATUS).toBe('scan:status')
    expect(IPC.PROFILE_SELECT).toBe('profile:select')
    expect(IPC.REGION_SELECT).toBe('region:select')
    expect(IPC.CONN_STATUS).toBe('conn:status')
  })

  it('defines THEME_OVERRIDES channel', () => {
    expect(IPC.THEME_OVERRIDES).toBe('theme:overrides')
  })
})
