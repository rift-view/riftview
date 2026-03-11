import { describe, it, expect, beforeEach } from 'vitest'
import { useCloudStore } from '../../../src/renderer/store/cloud'
import type { CloudNode, ScanDelta } from '../../../src/renderer/types/cloud'

const makeNode = (id: string): CloudNode => ({
  id, type: 'ec2', label: id, status: 'running', region: 'us-east-1', metadata: {},
})

describe('useCloudStore', () => {
  beforeEach(() => {
    useCloudStore.setState({ nodes: [], selectedNodeId: null, scanStatus: 'idle', profile: 'default', region: 'us-east-1' })
  })

  it('applies added nodes from delta', () => {
    useCloudStore.getState().applyDelta({ added: [makeNode('i-001')], changed: [], removed: [] })
    expect(useCloudStore.getState().nodes).toHaveLength(1)
    expect(useCloudStore.getState().nodes[0].id).toBe('i-001')
  })

  it('applies removed nodes from delta', () => {
    useCloudStore.setState({ nodes: [makeNode('i-001'), makeNode('i-002')] })
    useCloudStore.getState().applyDelta({ added: [], changed: [], removed: ['i-001'] })
    expect(useCloudStore.getState().nodes).toHaveLength(1)
    expect(useCloudStore.getState().nodes[0].id).toBe('i-002')
  })

  it('applies changed nodes from delta', () => {
    useCloudStore.setState({ nodes: [makeNode('i-001')] })
    const changed = { ...makeNode('i-001'), status: 'stopped' as const }
    useCloudStore.getState().applyDelta({ added: [], changed: [changed], removed: [] })
    expect(useCloudStore.getState().nodes[0].status).toBe('stopped')
  })

  it('sets selected node', () => {
    useCloudStore.getState().selectNode('i-001')
    expect(useCloudStore.getState().selectedNodeId).toBe('i-001')
  })

  it('sets scan status', () => {
    useCloudStore.getState().setScanStatus('scanning')
    expect(useCloudStore.getState().scanStatus).toBe('scanning')
  })
})
