// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('useUIStore — collapsedApigws', () => {
  beforeEach(() => {
    useUIStore.setState({ collapsedApigws: new Set<string>() })
  })

  it('toggleApigw adds an id when not present', () => {
    useUIStore.getState().toggleApigw('api-123')
    expect(useUIStore.getState().isApigwCollapsed('api-123')).toBe(true)
  })

  it('toggleApigw removes an id when present', () => {
    useUIStore.getState().toggleApigw('api-123')
    useUIStore.getState().toggleApigw('api-123')
    expect(useUIStore.getState().isApigwCollapsed('api-123')).toBe(false)
  })

  it('isApigwCollapsed returns false for unknown id', () => {
    expect(useUIStore.getState().isApigwCollapsed('unknown')).toBe(false)
  })

  it('toggling one id does not affect another', () => {
    useUIStore.getState().toggleApigw('api-1')
    expect(useUIStore.getState().isApigwCollapsed('api-2')).toBe(false)
  })
})
