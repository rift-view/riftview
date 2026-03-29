import { describe, it, expect } from 'vitest'
import { compareDrift, applyDriftToState } from '../../../src/renderer/utils/compareDrift'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(id: string, type: CloudNode['type'] = 'ec2', label = id): CloudNode {
  return { id, type, label, status: 'running', region: 'us-east-1', metadata: { instance_type: 't3.micro' } }
}

function imported(id: string, type: CloudNode['type'] = 'ec2', label = id): CloudNode {
  return { id, type, label, status: 'imported', region: 'us-east-1', metadata: { instance_type: 't3.micro' } }
}

describe('compareDrift', () => {
  it('returns empty results for empty inputs', () => {
    const result = compareDrift([], [])
    expect(result.matched).toEqual([])
    expect(result.unmanaged).toEqual([])
    expect(result.missing).toEqual([])
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

describe('compareDrift — fuzzy label matching', () => {
  it('matches by normalised label when IDs differ, same type', () => {
    const live = node('i-0abc123', 'ec2', 'my-web-server')
    const imp  = imported('aws_instance.my_web_server', 'ec2', 'my-web-server')
    const result = compareDrift([live], [imp])
    expect(result.matched).toContain('i-0abc123')
    expect(result.unmanaged).toHaveLength(0)
    expect(result.missing).toHaveLength(0)
    expect(result.fuzzyMap?.get('i-0abc123')).toBe('aws_instance.my_web_server')
  })

  it('normalises separators: hyphens, underscores, spaces treated the same', () => {
    const live = node('i-111', 'ec2', 'my web server')
    const imp  = imported('aws_instance.my_web_server', 'ec2', 'my_web_server')
    const result = compareDrift([live], [imp])
    expect(result.matched).toContain('i-111')
  })

  it('does NOT fuzzy-match across different types', () => {
    const live = node('bucket-abc', 's3', 'my-bucket')
    const imp  = imported('aws_lambda.my_bucket', 'lambda', 'my-bucket')
    const result = compareDrift([live], [imp])
    expect(result.matched).toHaveLength(0)
    expect(result.unmanaged).toContain('bucket-abc')
    expect(result.missing).toContain('aws_lambda.my_bucket')
  })

  it('exact ID match takes priority over fuzzy label match', () => {
    const live = node('i-exact', 'ec2', 'shared-name')
    const impExact = imported('i-exact', 'ec2', 'shared-name')
    const impFuzzy = imported('aws_instance.other', 'ec2', 'shared-name')
    const result = compareDrift([live], [impExact, impFuzzy])
    // should match exactly by ID, not fuzzily
    expect(result.matched).toContain('i-exact')
    expect(result.fuzzyMap?.has('i-exact')).toBeFalsy()
    expect(result.missing).toContain('aws_instance.other')
  })

  it('each imported node is only consumed once in fuzzy matching', () => {
    const live1 = node('i-001', 'ec2', 'same-name')
    const live2 = node('i-002', 'ec2', 'same-name')
    const imp   = imported('aws_instance.same_name', 'ec2', 'same-name')
    const result = compareDrift([live1, live2], [imp])
    // Only one live node can claim the fuzzy match
    expect(result.matched).toHaveLength(1)
    expect(result.unmanaged).toHaveLength(1)
  })
})

describe('applyDriftToState — fuzzy matches', () => {
  it('copies tfMetadata from fuzzy-matched imported node', () => {
    const live = node('i-0abc123', 'ec2', 'my-server')
    const imp  = { ...imported('aws_instance.my_server', 'ec2', 'my-server'), metadata: { instance_type: 't3.large' } }
    const result = applyDriftToState([live], [imp])
    const liveNode = result.nodes.find((n) => n.id === 'i-0abc123')!
    expect(liveNode.driftStatus).toBe('matched')
    expect(liveNode.tfMetadata).toEqual({ instance_type: 't3.large' })
    expect(result.importedNodes).toHaveLength(0)
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
