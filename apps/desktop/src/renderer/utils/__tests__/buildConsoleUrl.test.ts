import { describe, it, expect } from 'vitest'
import { buildConsoleUrl } from '../buildConsoleUrl'
import type { CloudNode } from '@riftview/shared'

function makeNode(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    type: 'aws:ec2',
    label: 'my-resource',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides
  }
}

describe('buildConsoleUrl', () => {
  it('returns EC2 URL with instance ID', () => {
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

  it('returns Cognito URL with pool ID', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:cognito', id: 'us-east-1_ABCDEFGH', region: 'us-east-1' })
    )
    expect(url).toContain('cognito')
    expect(url).toContain('us-east-1_ABCDEFGH')
  })

  it('returns APIGW URL with API ID extracted from ARN', () => {
    const url = buildConsoleUrl(
      makeNode({
        type: 'aws:apigw',
        id: 'arn:aws:apigateway:us-east-1::/apis/abc123def',
        region: 'us-east-1'
      })
    )
    expect(url).toContain('apigateway')
    expect(url).toContain('abc123def')
  })

  it('returns RDS URL using label as database identifier', () => {
    const url = buildConsoleUrl(
      makeNode({
        type: 'aws:rds',
        id: 'my-db-instance',
        label: 'my-db-instance',
        region: 'us-east-1'
      })
    )
    expect(url).toContain('rds')
    expect(url).toContain('my-db-instance')
  })

  it('returns null for apigw-route', () => {
    expect(buildConsoleUrl(makeNode({ type: 'aws:apigw-route' }))).toBeNull()
  })

  it('returns null for unknown', () => {
    expect(buildConsoleUrl(makeNode({ type: 'unknown' }))).toBeNull()
  })

  it('returns Step Functions URL with state machine ARN', () => {
    const arn = 'arn:aws:states:us-east-1:123456789:stateMachine:MyMachine'
    const url = buildConsoleUrl(makeNode({ type: 'aws:sfn', id: arn, region: 'us-east-1' }))
    expect(url).toContain('states')
    expect(url).toContain(encodeURIComponent(arn))
  })

  it('returns Kinesis URL with stream name', () => {
    const url = buildConsoleUrl(
      makeNode({ type: 'aws:kinesis', label: 'my-stream', region: 'us-east-1' })
    )
    expect(url).toContain('kinesis')
    expect(url).toContain('my-stream')
  })
})
