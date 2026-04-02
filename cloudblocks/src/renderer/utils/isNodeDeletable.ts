import type { CloudNode } from '../types/cloud'

export interface DeletableResult {
  deletable: boolean
  reason?: string  // shown on hover in context menu when deletable: false
}

export function isNodeDeletable(node: CloudNode): DeletableResult {
  // EventBridge default bus cannot be deleted
  if (node.type === 'eventbridge-bus' && node.label === 'default') {
    return { deletable: false, reason: 'Cannot delete the default EventBridge bus' }
  }
  // RDS with deletion protection enabled
  if (node.type === 'rds' && (node.metadata as { deletionProtection?: boolean }).deletionProtection === true) {
    return { deletable: false, reason: 'RDS deletion protection is enabled — disable it first' }
  }
  // CloudFront without ETag — cannot issue the delete command
  if (node.type === 'cloudfront' && !(node.metadata as { eTag?: string }).eTag) {
    return { deletable: false, reason: 'CloudFront ETag not available — re-scan to fetch it' }
  }
  return { deletable: true }
}
