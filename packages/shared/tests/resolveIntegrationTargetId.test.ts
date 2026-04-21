import { describe, it, expect } from 'vitest'
import { resolveIntegrationTargetId } from '../src/graph/resolveIntegrationTargetId'
import type { CloudNode } from '../src/types/cloud'

function makeNode(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'node-id',
    type: 's3',
    label: 'test',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides
  }
}

describe('resolveIntegrationTargetId', () => {
  it('returns targetId unchanged when it already matches a node ID', () => {
    const nodes = [makeNode({ id: 'arn:aws:s3:::my-bucket', type: 's3' })]
    expect(resolveIntegrationTargetId(nodes, 'arn:aws:s3:::my-bucket')).toBe(
      'arn:aws:s3:::my-bucket'
    )
  })

  it('resolves ALB domain to ALB node id when metadata.dnsName matches', () => {
    const albDomain = 'my-alb-1234567890.us-east-1.elb.amazonaws.com'
    const nodes = [
      makeNode({
        id: 'arn:aws:elasticloadbalancing:us-east-1:123456789:loadbalancer/app/my-alb/abc',
        type: 'alb',
        metadata: { dnsName: albDomain }
      })
    ]
    expect(resolveIntegrationTargetId(nodes, albDomain)).toBe(
      'arn:aws:elasticloadbalancing:us-east-1:123456789:loadbalancer/app/my-alb/abc'
    )
  })

  it('resolves APIGW domain to APIGW node id when endpoint hostname matches', () => {
    const apigwDomain = 'abc123def.execute-api.us-east-1.amazonaws.com'
    const nodes = [
      makeNode({
        id: 'arn:aws:apigateway:us-east-1::/restapis/abc123def',
        type: 'apigw',
        metadata: { endpoint: `https://${apigwDomain}/prod` }
      })
    ]
    expect(resolveIntegrationTargetId(nodes, apigwDomain)).toBe(
      'arn:aws:apigateway:us-east-1::/restapis/abc123def'
    )
  })

  it('resolves APIGW domain when endpoint has no protocol prefix', () => {
    const apigwDomain = 'xyz789.execute-api.eu-west-1.amazonaws.com'
    const nodes = [
      makeNode({
        id: 'apigw-node-id',
        type: 'apigw',
        metadata: { endpoint: `${apigwDomain}/stage` }
      })
    ]
    expect(resolveIntegrationTargetId(nodes, apigwDomain)).toBe('apigw-node-id')
  })

  it('returns original targetId when no match is found', () => {
    const nodes = [makeNode({ id: 'some-other-node', type: 's3' })]
    expect(resolveIntegrationTargetId(nodes, 'unmatched-domain.example.com')).toBe(
      'unmatched-domain.example.com'
    )
  })

  it('returns original targetId for empty node list', () => {
    expect(resolveIntegrationTargetId([], 'some-domain.elb.amazonaws.com')).toBe(
      'some-domain.elb.amazonaws.com'
    )
  })

  it('resolves CloudFront domain to CloudFront node id via metadata.domainName', () => {
    const cfDomain = 'd1234abcd.cloudfront.net'
    const nodes = [
      makeNode({ id: 'EDFDVBD6EXAMPLE', type: 'cloudfront', metadata: { domainName: cfDomain } })
    ]
    expect(resolveIntegrationTargetId(nodes, cfDomain)).toBe('EDFDVBD6EXAMPLE')
  })

  it('resolves RDS endpoint hostname to RDS node id via metadata.endpoint', () => {
    const rdsHost = 'my-db.cxxx.us-east-1.rds.amazonaws.com'
    const nodes = [makeNode({ id: 'my-db-instance', type: 'rds', metadata: { endpoint: rdsHost } })]
    expect(resolveIntegrationTargetId(nodes, rdsHost)).toBe('my-db-instance')
  })

  it('resolves ECR image URI (exact) to ECR node id', () => {
    const uri = '123456789.dkr.ecr.us-east-1.amazonaws.com/my-repo'
    const nodes = [makeNode({ id: 'ecr-node-id', type: 'ecr-repo', metadata: { uri } })]
    expect(resolveIntegrationTargetId(nodes, uri)).toBe('ecr-node-id')
  })

  it('resolves ECR image URI with tag to ECR node id', () => {
    const uri = '123456789.dkr.ecr.us-east-1.amazonaws.com/my-repo'
    const nodes = [makeNode({ id: 'ecr-node-id', type: 'ecr-repo', metadata: { uri } })]
    expect(resolveIntegrationTargetId(nodes, `${uri}:latest`)).toBe('ecr-node-id')
  })
})
