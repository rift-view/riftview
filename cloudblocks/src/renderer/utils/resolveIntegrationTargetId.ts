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

  // Match against CloudFront domain name (e.g. d1234.cloudfront.net)
  const cfMatch = nodes.find(n => n.type === 'cloudfront' && n.metadata.domainName === targetId)
  if (cfMatch) return cfMatch.id

  // Match against RDS endpoint hostname (metadata.endpoint)
  const rdsMatch = nodes.find(n => n.type === 'rds' && n.metadata.endpoint === targetId)
  if (rdsMatch) return rdsMatch.id

  // Match against ECR repo URI — exact match or URI-with-tag/digest stripped
  const ecrMatch = nodes.find(n => {
    if (n.type !== 'ecr-repo') return false
    const uri = n.metadata.uri as string | undefined
    if (!uri) return false
    return uri === targetId || targetId.startsWith(uri + ':') || targetId.startsWith(uri + '@')
  })
  if (ecrMatch) return ecrMatch.id

  // Match against OpenSearch endpoint hostname
  const osMatch = nodes.find(n => {
    if (n.type !== 'opensearch') return false
    const ep = n.metadata.endpoint as string | undefined
    if (!ep) return false
    const host = ep.replace(/^https?:\/\//, '').split('/')[0] ?? ep
    return host === targetId || ep === targetId
  })
  if (osMatch) return osMatch.id

  // Match against ElastiCache primary endpoint hostname (*.cache.amazonaws.com)
  const ecMatch = nodes.find(n => {
    if (n.type !== 'elasticache') return false
    const ep = n.metadata.endpoint as string | undefined
    if (!ep) return false
    return ep === targetId || targetId.startsWith(ep)
  })
  if (ecMatch) return ecMatch.id

  // No match — return original (edge won't render but won't crash)
  return targetId
}
