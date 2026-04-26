import { describe, it, expect } from 'vitest'
import { buildConsoleUrl } from '../../../src/renderer/utils/buildConsoleUrl'
import type { CloudNode } from '@riftview/shared'

function makeNode(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    type: 'aws:ec2',
    label: 'my-instance',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides
  }
}

describe('buildConsoleUrl', () => {
  it('returns EC2 console URL with instance ID', () => {
    const url = buildConsoleUrl(
      makeNode({ id: 'i-1234567890abcdef0', type: 'aws:ec2', region: 'us-east-1' })
    )
    expect(url).toContain('ec2')
    expect(url).toContain('i-1234567890abcdef0')
    expect(url).toContain('us-east-1')
  })

  it('returns Lambda URL with function name', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:lambda', label: 'my-function', region: 'eu-west-1' })
    )
    expect(url).toContain('lambda')
    expect(url).toContain('my-function')
    expect(url).toContain('eu-west-1')
  })

  it('returns S3 URL with bucket name', () => {
    const url = buildConsoleUrl(makeNode({ type: 'aws:s3', label: 'my-bucket' }))
    expect(url).toContain('s3')
    expect(url).toContain('my-bucket')
  })

  it('returns CloudFront URL with distribution ID', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:cloudfront', id: 'E1ABCDEF2GHIJK', region: 'global' })
    )
    expect(url).toContain('cloudfront')
    expect(url).toContain('E1ABCDEF2GHIJK')
  })

  it('returns ECS URL with cluster and service name', () => {
    const url = buildConsoleUrl(
      makeNode({
        type: 'aws:ecs',
        label: 'my-service',
        region: 'us-east-1',
        metadata: { clusterName: 'my-cluster' }
      })
    )
    expect(url).toContain('ecs')
    expect(url).toContain('my-cluster')
    expect(url).toContain('my-service')
  })

  it('returns null for apigw-route', () => {
    expect(buildConsoleUrl(makeNode({ type: 'aws:apigw-route' }))).toBeNull()
  })

  it('returns null for unknown', () => {
    expect(buildConsoleUrl(makeNode({ type: 'unknown' }))).toBeNull()
  })

  it('returns Cognito URL with pool ID', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:cognito', id: 'us-east-1_ABCDEFGH', region: 'us-east-1' })
    )
    expect(url).toContain('cognito')
    expect(url).toContain('us-east-1_ABCDEFGH')
  })

  it('returns EKS URL with cluster name', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:eks', label: 'my-cluster', region: 'us-east-1' })
    )
    expect(url).toContain('eks')
    expect(url).toContain('my-cluster')
  })

  it('returns OpenSearch URL with domain name', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:opensearch', label: 'my-domain', region: 'us-east-1' })
    )
    expect(url).toContain('opensearch')
    expect(url).toContain('my-domain')
  })

  it('returns MSK URL', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:msk', label: 'my-cluster', region: 'us-east-1' })
    )
    expect(url).not.toBeNull()
    expect(url).toContain('msk')
  })
})
