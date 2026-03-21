import { describe, it, expect } from 'vitest'
import type { CloudNode, NodeStatus, ScanDelta } from '../../../src/renderer/types/cloud'

describe('NodeStatus includes imported', () => {
  it('imported is a valid NodeStatus', () => {
    const s: NodeStatus = 'imported'
    expect(s).toBe('imported')
  })
})

describe('CloudNode type', () => {
  it('accepts a valid CloudNode object', () => {
    const node: CloudNode = {
      id: 'arn:aws:ec2:us-east-1:123456789012:instance/i-0abc',
      type: 'ec2',
      label: 'i-0abc',
      status: 'running',
      region: 'us-east-1',
      metadata: { InstanceType: 't3.micro' },
    }
    expect(node.id).toBe('arn:aws:ec2:us-east-1:123456789012:instance/i-0abc')
    expect(node.status).toBe('running')
  })

  it('accepts a CloudNode with parentId', () => {
    const node: CloudNode = {
      id: 'i-0abc',
      type: 'ec2',
      label: 'i-0abc',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
      parentId: 'subnet-0abc',
    }
    expect(node.parentId).toBe('subnet-0abc')
  })
})

describe('ScanDelta type', () => {
  it('accepts a valid ScanDelta', () => {
    const delta: ScanDelta = {
      added: [],
      changed: [],
      removed: [],
    }
    expect(delta.added).toHaveLength(0)
    expect(delta.changed).toHaveLength(0)
    expect(delta.removed).toHaveLength(0)
  })

  it('removed field holds string ids', () => {
    const delta: ScanDelta = {
      added: [],
      changed: [],
      removed: ['i-001', 'i-002'],
    }
    expect(delta.removed[0]).toBe('i-001')
    expect(typeof delta.removed[0]).toBe('string')
  })
})
