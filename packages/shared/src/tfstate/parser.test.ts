import { describe, it, expect } from 'vitest'
import { parseTfState } from './parser'

const minimal = (type: string, attrs: Record<string, unknown>): string =>
  JSON.stringify({
    version: 4,
    resources: [{ type, name: 'main', instances: [{ attributes: attrs }] }]
  })

describe('parseTfState', () => {
  it('maps aws_instance to ec2 node', () => {
    const raw = minimal('aws_instance', {
      id: 'i-abc',
      instance_type: 't3.micro',
      subnet_id: 'sub-1',
      vpc_security_group_ids: []
    })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('aws:ec2')
    expect(nodes[0].status).toBe('imported')
  })

  it('maps aws_vpc to vpc node', () => {
    const raw = minimal('aws_vpc', {
      id: 'vpc-123',
      cidr_block: '10.0.0.0/16',
      tags: { Name: 'main-vpc' }
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:vpc')
  })

  it('maps aws_subnet to subnet node', () => {
    const raw = minimal('aws_subnet', {
      id: 'sub-1',
      vpc_id: 'vpc-123',
      cidr_block: '10.0.1.0/24',
      availability_zone: 'us-east-1a'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:subnet')
  })

  it('maps aws_security_group to security-group node', () => {
    const raw = minimal('aws_security_group', {
      id: 'sg-1',
      vpc_id: 'vpc-123',
      name: 'web-sg',
      description: 'Web SG'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:security-group')
  })

  it('maps aws_s3_bucket to s3 node', () => {
    const raw = minimal('aws_s3_bucket', { id: 'my-bucket', region: 'us-east-1' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:s3')
  })

  it('maps aws_lambda_function to lambda node', () => {
    const raw = minimal('aws_lambda_function', {
      function_name: 'my-fn',
      runtime: 'nodejs20.x',
      memory_size: 128,
      timeout: 30
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:lambda')
  })

  it('maps aws_db_instance to rds node', () => {
    const raw = minimal('aws_db_instance', {
      id: 'mydb',
      engine: 'postgres',
      instance_class: 'db.t3.micro',
      db_subnet_group_name: 'default'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:rds')
  })

  it('maps aws_lb to alb node', () => {
    const raw = minimal('aws_lb', {
      arn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-lb/1',
      name: 'my-lb',
      scheme: 'internet-facing',
      subnets: []
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:alb')
  })

  it('maps aws_alb to alb node', () => {
    const raw = minimal('aws_alb', {
      arn: 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-lb/2',
      name: 'my-lb2',
      scheme: 'internal',
      subnets: []
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:alb')
  })

  it('maps aws_api_gateway_v2_api to apigw node', () => {
    const raw = minimal('aws_api_gateway_v2_api', {
      id: 'abc123',
      name: 'my-api',
      protocol_type: 'HTTP'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:apigw')
  })

  it('maps aws_cloudfront_distribution to cloudfront node', () => {
    const raw = minimal('aws_cloudfront_distribution', {
      id: 'ABCDE',
      domain_name: 'd111111abcdef8.cloudfront.net'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:cloudfront')
  })

  it('maps aws_internet_gateway to igw node', () => {
    const raw = minimal('aws_internet_gateway', {
      id: 'igw-abc123',
      vpc_id: 'vpc-1',
      tags: { Name: 'main-igw' }
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:igw')
    expect(nodes[0].id).toBe('igw-abc123')
    expect(nodes[0].label).toBe('main-igw')
  })

  it('maps aws_nat_gateway to nat-gateway node', () => {
    const raw = minimal('aws_nat_gateway', { id: 'nat-abc123', subnet_id: 'sub-1' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:nat-gateway')
    expect(nodes[0].id).toBe('nat-abc123')
  })

  it('maps aws_sqs_queue to sqs node using queue ARN as ID', () => {
    const raw = minimal('aws_sqs_queue', {
      arn: 'arn:aws:sqs:us-east-1:123456789:my-queue',
      url: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:sqs')
    expect(nodes[0].id).toBe('arn:aws:sqs:us-east-1:123456789:my-queue')
    expect(nodes[0].label).toBe('my-queue')
  })

  it('maps aws_sns_topic to sns node using topic ARN as ID', () => {
    const raw = minimal('aws_sns_topic', { arn: 'arn:aws:sns:us-east-1:123456789:my-topic' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:sns')
    expect(nodes[0].id).toBe('arn:aws:sns:us-east-1:123456789:my-topic')
    expect(nodes[0].label).toBe('my-topic')
  })

  it('maps aws_dynamodb_table to dynamo node using table name as ID', () => {
    const raw = minimal('aws_dynamodb_table', { id: 'my-table', hash_key: 'id' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:dynamo')
    expect(nodes[0].id).toBe('my-table')
  })

  it('maps aws_ssm_parameter to ssm-param node using ARN as ID', () => {
    const raw = minimal('aws_ssm_parameter', {
      arn: 'arn:aws:ssm:us-east-1:123456789:parameter/my-param',
      name: '/my-param',
      type: 'String'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:ssm-param')
    expect(nodes[0].id).toBe('arn:aws:ssm:us-east-1:123456789:parameter/my-param')
    expect(nodes[0].label).toBe('/my-param')
  })

  it('maps aws_ssm_parameter to ssm-param node falling back to name when no ARN', () => {
    const raw = minimal('aws_ssm_parameter', { name: '/my-param', type: 'String' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:ssm-param')
    expect(nodes[0].id).toBe('/my-param')
  })

  it('maps aws_secretsmanager_secret to secret node using ARN as ID', () => {
    const raw = minimal('aws_secretsmanager_secret', {
      arn: 'arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret-abc123',
      name: 'my-secret'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:secret')
    expect(nodes[0].id).toBe('arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret-abc123')
    expect(nodes[0].label).toBe('my-secret')
  })

  it('maps aws_ecr_repository to ecr-repo node using repository ARN as ID', () => {
    const raw = minimal('aws_ecr_repository', {
      arn: 'arn:aws:ecr:us-east-1:123456789:repository/my-repo',
      name: 'my-repo'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:ecr-repo')
    expect(nodes[0].id).toBe('arn:aws:ecr:us-east-1:123456789:repository/my-repo')
    expect(nodes[0].label).toBe('my-repo')
  })

  it('maps aws_route53_zone to r53-zone node using hosted zone ID path', () => {
    const raw = minimal('aws_route53_zone', { id: '/hostedzone/Z1234ABCD', name: 'example.com.' })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:r53-zone')
    expect(nodes[0].id).toBe('/hostedzone/Z1234ABCD')
    expect(nodes[0].label).toBe('example.com.')
  })

  it('maps aws_sfn_state_machine to sfn node using ARN as ID', () => {
    const raw = minimal('aws_sfn_state_machine', {
      arn: 'arn:aws:states:us-east-1:123456789:stateMachine:my-machine',
      name: 'my-machine'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:sfn')
    expect(nodes[0].id).toBe('arn:aws:states:us-east-1:123456789:stateMachine:my-machine')
    expect(nodes[0].label).toBe('my-machine')
  })

  it('maps aws_cloudwatch_event_bus to eventbridge-bus node using ARN as ID', () => {
    const raw = minimal('aws_cloudwatch_event_bus', {
      arn: 'arn:aws:events:us-east-1:123456789:event-bus/my-bus',
      name: 'my-bus'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:eventbridge-bus')
    expect(nodes[0].id).toBe('arn:aws:events:us-east-1:123456789:event-bus/my-bus')
    expect(nodes[0].label).toBe('my-bus')
  })

  it('maps aws_acm_certificate to acm node using ARN as ID', () => {
    const raw = minimal('aws_acm_certificate', {
      arn: 'arn:aws:acm:us-east-1:123456789:certificate/abc-123',
      domain_name: 'example.com'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:acm')
    expect(nodes[0].id).toBe('arn:aws:acm:us-east-1:123456789:certificate/abc-123')
    expect(nodes[0].label).toBe('example.com')
  })

  it('maps aws_apigatewayv2_route to apigw-route node with composite ID', () => {
    const raw = minimal('aws_apigatewayv2_route', {
      api_id: 'abc123',
      id: 'route-xyz',
      route_key: 'GET /users'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].type).toBe('aws:apigw-route')
    expect(nodes[0].id).toBe('abc123/routes/route-xyz')
    expect(nodes[0].label).toBe('GET /users')
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
    const raw = minimal('aws_db_instance', {
      id: 'mydb',
      engine: 'postgres',
      instance_class: 'db.t3.micro',
      db_subnet_group_name: 'default',
      password: 'hunter2',
      secret_arn: 'arn:aws:...'
    })
    const nodes = parseTfState(raw)
    expect(nodes[0].metadata).not.toHaveProperty('password')
    expect(nodes[0].metadata).not.toHaveProperty('secret_arn')
  })

  it('handles resources with multiple instances', () => {
    const raw = JSON.stringify({
      version: 4,
      resources: [
        {
          type: 'aws_s3_bucket',
          name: 'logs',
          instances: [
            { attributes: { id: 'bucket-1', region: 'us-east-1' } },
            { attributes: { id: 'bucket-2', region: 'us-west-2' } }
          ]
        }
      ]
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
      resources: [{ type: 'aws_s3_bucket', name: 'logs', instances: null }]
    })
    const nodes = parseTfState(raw)
    expect(nodes).toHaveLength(0)
  })
})
