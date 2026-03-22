import { describe, it, expect } from 'vitest'
import { compareDrift, applyDriftToState } from '../../../src/renderer/utils/compareDrift'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(id: string, type: CloudNode['type'] = 'ec2'): CloudNode {
  return { id, type, label: id, status: 'running', region: 'us-east-1', metadata: { instance_type: 't3.micro' } }
}

function imported(id: string, type: CloudNode['type'] = 'ec2'): CloudNode {
  return { id, type, label: id, status: 'imported', region: 'us-east-1', metadata: { instance_type: 't3.micro' } }
}

describe('compareDrift', () => {
  it('returns empty results for empty inputs', () => {
    const result = compareDrift([], [])
    expect(result).toEqual({ matched: [], unmanaged: [], missing: [] })
  })

  it('matches nodes with same ID', () => {
    const result = compareDrift([node('i-123')], [imported('i-123')])
    expect(result.matched).toEqual(['i-123'])
    expect(result.unmanaged).toEqual([])
    expect(result.missing).toEqual([])
  })

  it('marks live-only node as unmanaged', () => {
    const result = compareDrift([node('i-123')], [])
    expect(result.unmanaged).toEqual(['i-123'])
    expect(result.matched).toEqual([])
    expect(result.missing).toEqual([])
  })

  it('marks imported-only node as missing', () => {
    const result = compareDrift([], [imported('i-123')])
    expect(result.missing).toEqual(['i-123'])
    expect(result.matched).toEqual([])
    expect(result.unmanaged).toEqual([])
  })

  it('handles mixed matched/unmanaged/missing in one call', () => {
    const live = [node('i-match'), node('i-unmanaged')]
    const imp  = [imported('i-match'), imported('i-missing')]
    const result = compareDrift(live, imp)
    expect(result.matched).toEqual(['i-match'])
    expect(result.unmanaged).toEqual(['i-unmanaged'])
    expect(result.missing).toEqual(['i-missing'])
  })

  it('excludes type:unknown imported nodes from all buckets', () => {
    const result = compareDrift([node('i-123')], [imported('tf-unknown-aws_nat-1', 'unknown')])
    expect(result.missing).toEqual([])
    expect(result.unmanaged).toEqual(['i-123'])
  })
})

describe('applyDriftToState', () => {
  it('stamps driftStatus=matched and copies tfMetadata onto live node, removes from importedNodes', () => {
    const live = [node('i-123')]
    const imp  = [{ ...imported('i-123'), metadata: { instance_type: 't3.large' } }]
    const result = applyDriftToState(live, imp)
    const liveNode = result.nodes.find(n => n.id === 'i-123')!
    expect(liveNode.driftStatus).toBe('matched')
    expect(liveNode.tfMetadata).toEqual({ instance_type: 't3.large' })
    expect(result.importedNodes).toHaveLength(0)
  })

  it('stamps driftStatus=unmanaged on live-only nodes', () => {
    const result = applyDriftToState([node('i-123')], [])
    expect(result.nodes[0].driftStatus).toBe('unmanaged')
  })

  it('stamps driftStatus=missing on imported-only nodes, keeps them in importedNodes', () => {
    const result = applyDriftToState([], [imported('i-456')])
    expect(result.importedNodes[0].driftStatus).toBe('missing')
    expect(result.importedNodes).toHaveLength(1)
  })

  it('stamps unmanaged on all live nodes when importedNodes is empty', () => {
    // Note: cloud.ts guards against calling applyDriftToState when importedNodes.length === 0
    // but if called, all live nodes correctly become unmanaged
    const result = applyDriftToState([node('i-123')], [])
    expect(result.nodes[0].driftStatus).toBe('unmanaged')
  })

  it('excludes type:unknown imported nodes from matching', () => {
    const live = [node('i-123')]
    const imp  = [imported('tf-unknown-nat-1', 'unknown')]
    const result = applyDriftToState(live, imp)
    const liveNode = result.nodes.find(n => n.id === 'i-123')!
    expect(liveNode.driftStatus).toBe('unmanaged')
    // unknown imported node kept in importedNodes but marked missing? No — excluded entirely
    expect(result.importedNodes[0].driftStatus).toBeUndefined()
  })
})
