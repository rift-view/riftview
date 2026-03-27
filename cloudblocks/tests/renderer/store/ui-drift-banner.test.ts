import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('useUIStore — drift banner', () => {
  beforeEach(() => {
    useUIStore.setState({ driftBannerDismissed: false })
  })

  it('driftBannerDismissed defaults to false', () => {
    expect(useUIStore.getState().driftBannerDismissed).toBe(false)
  })

  it('dismissDriftBanner sets driftBannerDismissed to true', () => {
    useUIStore.getState().dismissDriftBanner()
    expect(useUIStore.getState().driftBannerDismissed).toBe(true)
  })

  it('resetDriftBanner sets driftBannerDismissed to false after dismiss', () => {
    useUIStore.getState().dismissDriftBanner()
    expect(useUIStore.getState().driftBannerDismissed).toBe(true)
    useUIStore.getState().resetDriftBanner()
    expect(useUIStore.getState().driftBannerDismissed).toBe(false)
  })
})
