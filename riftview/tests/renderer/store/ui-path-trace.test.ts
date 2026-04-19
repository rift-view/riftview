import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

beforeEach(() => {
  useUIStore.setState({
    blastRadiusId: null,
    pathTraceId: null
  })
})

describe('pathTraceId / blastRadiusId coexistence', () => {
  it('pathTraceId starts null', () => {
    expect(useUIStore.getState().pathTraceId).toBeNull()
  })

  it('setPathTraceId sets pathTraceId and clears blastRadiusId', () => {
    useUIStore.getState().setBlastRadiusId('node-1')
    useUIStore.getState().setPathTraceId('node-2')
    expect(useUIStore.getState().pathTraceId).toBe('node-2')
    expect(useUIStore.getState().blastRadiusId).toBeNull()
  })

  it('setBlastRadiusId sets blastRadiusId and clears pathTraceId', () => {
    useUIStore.getState().setPathTraceId('node-2')
    useUIStore.getState().setBlastRadiusId('node-1')
    expect(useUIStore.getState().blastRadiusId).toBe('node-1')
    expect(useUIStore.getState().pathTraceId).toBeNull()
  })

  it('setPathTraceId(null) clears pathTraceId', () => {
    useUIStore.getState().setPathTraceId('node-2')
    useUIStore.getState().setPathTraceId(null)
    expect(useUIStore.getState().pathTraceId).toBeNull()
  })
})
