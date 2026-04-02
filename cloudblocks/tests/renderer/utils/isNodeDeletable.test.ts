import { describe, it, expect } from 'vitest'
import { isNodeDeletable } from '../../../src/renderer/utils/isNodeDeletable'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeNode(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    type: 'ec2',
    label: 'test-label',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  }
}

describe('isNodeDeletable', () => {
  it('EventBridge default bus is not deletable', () => {
    const node = makeNode({ type: 'eventbridge-bus', label: 'default' })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(false)
    expect(result.reason).toBe('Cannot delete the default EventBridge bus')
  })

  it('EventBridge non-default bus is deletable', () => {
    const node = makeNode({ type: 'eventbridge-bus', label: 'my-custom-bus' })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('RDS with deletionProtection true is not deletable', () => {
    const node = makeNode({ type: 'rds', metadata: { deletionProtection: true } })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(false)
    expect(result.reason).toBe('RDS deletion protection is enabled — disable it first')
  })

  it('RDS with deletionProtection false is deletable', () => {
    const node = makeNode({ type: 'rds', metadata: { deletionProtection: false } })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(true)
  })

  it('CloudFront without eTag is not deletable', () => {
    const node = makeNode({ type: 'cloudfront', metadata: {} })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(false)
    expect(result.reason).toBe('CloudFront ETag not available — re-scan to fetch it')
  })

  it('CloudFront with eTag is deletable', () => {
    const node = makeNode({ type: 'cloudfront', metadata: { eTag: 'E2QWRUHEXAMPLE' } })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(true)
  })

  it('EC2 instance is deletable', () => {
    const node = makeNode({ type: 'ec2' })
    const result = isNodeDeletable(node)
    expect(result.deletable).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})
