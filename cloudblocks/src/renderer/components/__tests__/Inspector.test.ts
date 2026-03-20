import { describe, it, expect } from 'vitest'
import { edgeTypeLabel } from '../../utils/edgeTypeLabel'

describe('edgeTypeLabel', () => {
  it('returns "CloudFront Origin" for cf-origin- prefix', () => {
    expect(edgeTypeLabel('cf-origin-abc123')).toBe('CloudFront Origin')
  })

  it('returns "ACM Certificate" for cf-cert- prefix', () => {
    expect(edgeTypeLabel('cf-cert-xyz789')).toBe('ACM Certificate')
  })

  it('returns "API Gateway Route" for apigw-route- prefix', () => {
    expect(edgeTypeLabel('apigw-route-get-users')).toBe('API Gateway Route')
  })

  it('returns "Route → Lambda" for route-lambda- prefix', () => {
    expect(edgeTypeLabel('route-lambda-fn-arn')).toBe('Route → Lambda')
  })

  it('returns "Integration: trigger" for integration edge with edgeType trigger', () => {
    expect(edgeTypeLabel('integration-sqs-fn', { isIntegration: true, edgeType: 'trigger' })).toBe('Integration: trigger')
  })

  it('returns "Integration: subscription" for integration edge with edgeType subscription', () => {
    expect(edgeTypeLabel('integration-sns-fn', { isIntegration: true, edgeType: 'subscription' })).toBe('Integration: subscription')
  })

  it('returns "Integration: origin" for integration edge with edgeType origin', () => {
    expect(edgeTypeLabel('integration-cf-s3', { isIntegration: true, edgeType: 'origin' })).toBe('Integration: origin')
  })

  it('returns "Integration" for integration edge with unknown edgeType', () => {
    expect(edgeTypeLabel('integration-foo', { isIntegration: true, edgeType: 'unknown' })).toBe('Integration')
  })

  it('returns "Integration" for integration edge with no edgeType', () => {
    expect(edgeTypeLabel('integration-foo', { isIntegration: true })).toBe('Integration')
  })

  it('returns "Connection" for unknown prefix', () => {
    expect(edgeTypeLabel('some-random-edge-id')).toBe('Connection')
  })

  it('returns "Connection" for empty string', () => {
    expect(edgeTypeLabel('')).toBe('Connection')
  })
})
