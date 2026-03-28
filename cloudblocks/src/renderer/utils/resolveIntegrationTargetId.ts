import type { CloudNode } from '../types/cloud'

/**
 * Resolves an integration targetId that may be a raw domain name (for ALB/APIGW origins)
 * to the actual node ID by matching against node metadata.
 * Returns the original targetId if no match is found (it may already be a valid node ID).
 */
export function resolveIntegrationTargetId(nodes: CloudNode[], targetId: string): string {
  // Already a node ID — fast path
  if (nodes.some(n => n.id === targetId)) return targetId

  // Match against ALB dnsName
  const albMatch = nodes.find(n => n.type === 'alb' && n.metadata.dnsName === targetId)
  if (albMatch) return albMatch.id

  // Match against APIGW endpoint hostname
  const apigwMatch = nodes.find(n => {
    if (n.type !== 'apigw') return false
    const endpoint = n.metadata.endpoint as string | undefined
    if (!endpoint) return false
    try {
      return new URL(endpoint.startsWith('http') ? endpoint : `https://${endpoint}`).hostname === targetId
    } catch { return false }
  })
  if (apigwMatch) return apigwMatch.id

  // No match — return original (edge won't render but won't crash)
  return targetId
}
