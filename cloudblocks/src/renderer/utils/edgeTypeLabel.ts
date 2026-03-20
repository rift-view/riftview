export function edgeTypeLabel(edgeId: string, edgeData?: Record<string, unknown>): string {
  if (edgeData?.isIntegration) {
    const et = edgeData.edgeType as string | undefined
    if (et === 'trigger') return 'Integration: trigger'
    if (et === 'subscription') return 'Integration: subscription'
    if (et === 'origin') return 'Integration: origin'
    return 'Integration'
  }
  if (edgeId.startsWith('cf-origin-')) return 'CloudFront Origin'
  if (edgeId.startsWith('cf-cert-')) return 'ACM Certificate'
  if (edgeId.startsWith('apigw-route-')) return 'API Gateway Route'
  if (edgeId.startsWith('route-lambda-')) return 'Route → Lambda'
  return 'Connection'
}
