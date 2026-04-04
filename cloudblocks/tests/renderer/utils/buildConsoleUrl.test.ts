import { describe, it, expect } from 'vitest'
import { buildConsoleUrl } from '../../../src/renderer/utils/buildConsoleUrl'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeNode(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    type: 'ec2',
    label: 'my-instance',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides,
  }
}

describe('buildConsoleUrl', () => {
  it('returns EC2 console URL with instance ID', () => {
    const url = buildConsoleUrl(makeNode({ id: 'i-1234567890abcdef0', type: 'ec2', region: 'us-east-1' }))
    expect(url).toContain('ec2')
    expect(url).toContain('i-1234567890abcdef0')
    expect(url).toContain('us-east-1')
  })

  it('returns Lambda URL with function name', () => {
    const url = buildConsoleUrl(makeNode({ type: 'lambda', label: 'my-function', region: 'eu-west-1' }))
    expect(url).toContain('lambda')
    expect(url).toContain('my-function')
    expect(url).toContain('eu-west-1')
  })

  it('returns S3 URL with bucket name', () => {
    const url = buildConsoleUrl(makeNode({ type: 's3', label: 'my-bucket' }))
    expect(url).toContain('s3')
    expect(url).toContain('my-bucket')
  })

  it('returns CloudFront URL with distribution ID', () => {
    const url = buildConsoleUrl(makeNode({ type: 'cloudfront', id: 'E1ABCDEF2GHIJK', region: 'global' }))
    expect(url).toContain('cloudfront')
    expect(url).toContain('E1ABCDEF2GHIJK')
  })

  it('returns ECS URL with cluster and service name', () => {
    const url = buildConsoleUrl(makeNode({
      type: 'ecs',
      label: 'my-service',
      region: 'us-east-1',
      metadata: { clusterName: 'my-cluster' },
    }))
    expect(url).toContain('ecs')
    expect(url).toContain('my-cluster')
    expect(url).toContain('my-service')
  })

  it('returns null for apigw-route', () => {
    expect(buildConsoleUrl(makeNode({ type: 'apigw-route' }))).toBeNull()
  })

  it('returns null for unknown', () => {
    expect(buildConsoleUrl(makeNode({ type: 'unknown' }))).toBeNull()
  })

  it('returns Cognito URL with pool ID', () => {
    const url = buildConsoleUrl(makeNode({ type: 'cognito', id: 'us-east-1_ABCDEFGH', region: 'us-east-1' }))
    expect(url).toContain('cognito')
    expect(url).toContain('us-east-1_ABCDEFGH')
  })

  it('returns EKS URL with cluster name', () => {
    const url = buildConsoleUrl(makeNode({ type: 'eks', label: 'my-cluster', region: 'us-east-1' }))
    expect(url).toContain('eks')
    expect(url).toContain('my-cluster')
  })

  it('returns OpenSearch URL with domain name', () => {
    const url = buildConsoleUrl(makeNode({ type: 'opensearch', label: 'my-domain', region: 'us-east-1' }))
    expect(url).toContain('opensearch')
    expect(url).toContain('my-domain')
  })

  it('returns MSK URL', () => {
    const url = buildConsoleUrl(makeNode({ type: 'msk', label: 'my-cluster', region: 'us-east-1' }))
    expect(url).not.toBeNull()
    expect(url).toContain('msk')
  })
})
