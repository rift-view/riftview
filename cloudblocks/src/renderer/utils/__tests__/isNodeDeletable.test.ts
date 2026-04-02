import { describe, it, expect } from 'vitest'
import { isNodeDeletable } from '../isNodeDeletable'
import type { CloudNode } from '../../types/cloud'

function node(
  type: CloudNode['type'],
  id: string,
  label?: string,
  metadata: Record<string, unknown> = {},
): CloudNode {
  return { id, type, label: label ?? id, status: 'running', region: 'us-east-1', metadata }
}

describe('isNodeDeletable', () => {
  it('EventBridge default bus → not deletable', () => {
    const result = isNodeDeletable(node('eventbridge-bus', 'arn:aws:events:us-east-1:123:event-bus/default', 'default'))
    expect(result.deletable).toBe(false)
    expect(result.reason).toBe('Cannot delete the default EventBridge bus')
  })

  it('EventBridge non-default bus → deletable', () => {
    const result = isNodeDeletable(node('eventbridge-bus', 'arn:aws:events:us-east-1:123:event-bus/my-bus', 'my-bus'))
    expect(result.deletable).toBe(true)
    expect(result.reason).toBeUndefined()
  })

  it('RDS with deletionProtection: true → not deletable', () => {
    const result = isNodeDeletable(node('rds', 'mydb', 'mydb', { deletionProtection: true }))
    expect(result.deletable).toBe(false)
    expect(result.reason).toBe('RDS deletion protection is enabled — disable it first')
  })

  it('RDS with deletionProtection: false → deletable', () => {
    const result = isNodeDeletable(node('rds', 'mydb', 'mydb', { deletionProtection: false }))
    expect(result.deletable).toBe(true)
  })

  it('CloudFront without eTag → not deletable', () => {
    const result = isNodeDeletable(node('cloudfront', 'ABCDEF123', 'My Distribution', {}))
    expect(result.deletable).toBe(false)
    expect(result.reason).toBe('CloudFront ETag not available — re-scan to fetch it')
  })

  it('CloudFront with eTag → deletable', () => {
    const result = isNodeDeletable(node('cloudfront', 'ABCDEF123', 'My Distribution', { eTag: 'E2QWRUHEXAMPLE' }))
    expect(result.deletable).toBe(true)
  })

  it('EC2 instance → deletable', () => {
    const result = isNodeDeletable(node('ec2', 'i-1234567890abcdef0'))
    expect(result.deletable).toBe(true)
    expect(result.reason).toBeUndefined()
  })
})
