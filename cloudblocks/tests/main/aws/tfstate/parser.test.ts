import { describe, it, expect } from 'vitest'
import { parseTfState } from '../../../../src/main/aws/tfstate/parser'

const minimal = (type: string, attrs: Record<string, unknown>) =>
  JSON.stringify({
    version: 4,
    resources: [{ type, name: 'main', instances: [{ attributes: attrs }] }],
  })

describe('parseTfState', () => {
  it('maps aws_instance to ec2 node', () => {
    const raw = minimal('aws_instance', { id: 'i-abc', instance_type: 't3.micro', subnet_id: 'sub-1', vpc_security_group_ids: [] })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('ec2')
    expect(nodes[0].status).toBe('imported')
  })

  it('maps aws_vpc to vpc node', () => {
    const raw = minimal('aws_vpc', { id: 'vpc-123', cidr_block: '10.0.0.0/16', tags: { Name: 'main-vpc' } })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('vpc')
  })

  it('maps aws_subnet to subnet node', () => {
    const raw = minimal('aws_subnet', { id: 'sub-1', vpc_id: 'vpc-123', cidr_block: '10.0.1.0/24', availability_zone: 'us-east-1a' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('subnet')
  })

  it('maps aws_security_group to security-group node', () => {
    const raw = minimal('aws_security_group', { id: 'sg-1', vpc_id: 'vpc-123', name: 'web-sg', description: 'Web SG' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('security-group')
  })

  it('maps aws_s3_bucket to s3 node', () => {
    const raw = minimal('aws_s3_bucket', { id: 'my-bucket', region: 'us-east-1' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('s3')
  })

  it('maps aws_lambda_function to lambda node', () => {
    const raw = minimal('aws_lambda_function', { function_name: 'my-fn', runtime: 'nodejs20.x', memory_size: 128, timeout: 30 })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('lambda')
  })

  it('maps aws_db_instance to rds node', () => {
    const raw = minimal('aws_db_instance', { id: 'mydb', engine: 'postgres', instance_class: 'db.t3.micro', db_subnet_group_name: 'default' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('rds')
  })

  it('maps aws_lb to alb node', () => {
    const raw = minimal('aws_lb', { arn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-lb/1', name: 'my-lb', scheme: 'internet-facing', subnets: [] })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('alb')
  })

  it('maps aws_alb to alb node', () => {
    const raw = minimal('aws_alb', { arn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-lb/2', name: 'my-lb2', scheme: 'internal', subnets: [] })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('alb')
  })

  it('maps aws_api_gateway_v2_api to apigw node', () => {
    const raw = minimal('aws_api_gateway_v2_api', { id: 'abc123', name: 'my-api', protocol_type: 'HTTP' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('apigw')
  })

  it('maps aws_cloudfront_distribution to cloudfront node', () => {
    const raw = minimal('aws_cloudfront_distribution', { id: 'ABCDE', domain_name: 'd111111abcdef8.cloudfront.net' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('cloudfront')
  })

  it('maps unknown aws_* to unknown node with warning', () => {
    const raw = minimal('aws_route_table', { id: 'rt-1' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('unknown')
    expect(nodes[0].metadata?.unsupportedTfType).toBe('aws_route_table')
  })

  it('skips non-aws resources silently', () => {
    const raw = minimal('azurerm_resource_group', { id: '/subscriptions/123' })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(0)
  })

  it('strips sensitive keys from attributes', () => {
    const raw = minimal('aws_db_instance', { id: 'mydb', engine: 'postgres', instance_class: 'db.t3.micro', db_subnet_group_name: 'default', password: 'hunter2', secret_arn: 'arn:aws:...' })
    const nodes = parseTfState(raw)
    expect(nodes[0].metadata).not.toHaveProperty('password')
    expect(nodes[0].metadata).not.toHaveProperty('secret_arn')
  })

  it('handles resources with multiple instances', () => {
    const raw = JSON.stringify({
      version: 4,
      resources: [{ type: 'aws_s3_bucket', name: 'logs', instances: [
        { attributes: { id: 'bucket-1', region: 'us-east-1' } },
        { attributes: { id: 'bucket-2', region: 'us-west-2' } },
      ]}],
    })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(2)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseTfState('not json')).toThrow()
  })

  it('throws on missing resources array', () => {
    expect(() => parseTfState('{"version":4}')).toThrow()
  })

  it('handles missing instances array gracefully', () => {
    const raw = JSON.stringify({
      version: 4,
      resources: [{ type: 'aws_s3_bucket', name: 'logs', instances: null }],
    })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(0)
  })
})
