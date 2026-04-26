import { describe, it, expect, vi, beforeEach } from 'vitest'
import { expectNodeTypeMetadataAlignment } from './helpers'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

vi.mock('../../aws/client', () => ({
  createClients: vi.fn().mockReturnValue({ stubClient: true })
}))

vi.mock('../../aws/services/ec2', () => ({
  describeInstances: vi.fn().mockResolvedValue([]),
  describeVpcs: vi.fn().mockResolvedValue([]),
  describeSubnets: vi.fn().mockResolvedValue([]),
  describeSecurityGroups: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/igw', () => ({
  listInternetGateways: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/nat', () => ({
  listNatGateways: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/rds', () => ({
  describeDBInstances: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/s3', () => ({
  listBuckets: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/lambda', () => ({
  listFunctions: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/alb', () => ({
  describeLoadBalancers: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/acm', () => ({
  listCertificates: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/cloudfront', () => ({
  listDistributions: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/apigw', () => ({
  listApis: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/sqs', () => ({
  listQueues: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/secrets', () => ({
  listSecrets: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/ecr', () => ({
  listRepositories: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/sns', () => ({
  listTopics: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/dynamo', () => ({
  listTables: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/ssm', () => ({
  listParameters: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/r53', () => ({
  listHostedZones: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/sfn', () => ({
  listStateMachines: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/eventbridge', () => ({
  listEventBuses: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/ses', () => ({
  listIdentities: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/cognito', () => ({
  listUserPools: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/kinesis', () => ({
  listStreams: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/ecs', () => ({
  listEcsServices: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/elasticache', () => ({
  listCacheClusters: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/eks', () => ({
  listEksClusters: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/opensearch', () => ({
  listOpenSearchDomains: vi.fn().mockResolvedValue([])
}))

vi.mock('../../aws/services/msk', () => ({
  listMskClusters: vi.fn().mockResolvedValue([])
}))

const ALL_NODE_TYPES = [
  'aws:ec2',
  'aws:vpc',
  'aws:subnet',
  'aws:rds',
  'aws:s3',
  'aws:lambda',
  'aws:alb',
  'aws:security-group',
  'aws:igw',
  'aws:acm',
  'aws:cloudfront',
  'aws:apigw',
  'aws:apigw-route',
  'aws:sqs',
  'aws:secret',
  'aws:ecr-repo',
  'aws:sns',
  'aws:dynamo',
  'aws:ssm-param',
  'aws:nat-gateway',
  'aws:r53-zone',
  'aws:sfn',
  'aws:eventbridge-bus',
  'aws:ses',
  'aws:cognito',
  'aws:kinesis',
  'aws:ecs',
  'aws:elasticache',
  'aws:eks',
  'aws:opensearch',
  'aws:msk',
  'unknown'
] as const

describe('awsPlugin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let awsPlugin: any

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../awsPlugin')
    awsPlugin = mod.awsPlugin
  })

  it('has id "com.riftview.aws"', () => {
    expect(awsPlugin.id).toBe('com.riftview.aws')
  })

  it('has displayName "Amazon Web Services"', () => {
    expect(awsPlugin.displayName).toBe('Amazon Web Services')
  })

  it('nodeTypes contains all 32 NodeType values', () => {
    for (const t of ALL_NODE_TYPES) {
      expect(awsPlugin.nodeTypes).toContain(t)
    }
    expect(awsPlugin.nodeTypes).toHaveLength(ALL_NODE_TYPES.length)
  })

  it('nodeTypeMetadata has an entry for every nodeType', () => {
    expectNodeTypeMetadataAlignment(awsPlugin)
  })

  it('createCredentials calls createClients and returns clients', async () => {
    const { createClients } = await import('../../aws/client')
    const result = awsPlugin.createCredentials('default', 'us-east-1')
    expect(createClients).toHaveBeenCalledWith('default', 'us-east-1', undefined)
    expect(result).toEqual({ stubClient: true })
  })

  it('createCredentials passes endpoint when provided', async () => {
    const { createClients } = await import('../../aws/client')
    awsPlugin.createCredentials('default', 'us-east-1', 'http://localhost:4566')
    expect(createClients).toHaveBeenCalledWith('default', 'us-east-1', 'http://localhost:4566')
  })

  it('scan() returns merged nodes from all services', async () => {
    const { describeInstances } = await import('../../aws/services/ec2')
    const mockNode = {
      id: 'i-123',
      type: 'aws:ec2',
      label: 'web',
      status: 'running',
      region: 'us-east-1',
      metadata: {}
    }
    vi.mocked(describeInstances).mockResolvedValueOnce([mockNode] as never)

    const stubClients = {
      ec2: {},
      rds: {},
      s3: {},
      lambda: {},
      alb: {},
      acm: {},
      cloudfront: {},
      apigw: {},
      sqs: {},
      secrets: {},
      ecr: {},
      sns: {},
      dynamo: {},
      ssm: {},
      r53: {},
      sfn: {},
      eventbridge: {},
      iam: {}
    }

    const result = await awsPlugin.scan({ credentials: stubClients, region: 'us-east-1' })
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('i-123')
    expect(result.errors).toEqual([])
  })

  it('scan() collects errors from failing services without dropping healthy results', async () => {
    const { listQueues } = await import('../../aws/services/sqs')
    const { describeInstances } = await import('../../aws/services/ec2')
    const mockNode = {
      id: 'i-456',
      type: 'aws:ec2',
      label: 'db',
      status: 'running',
      region: 'us-east-1',
      metadata: {}
    }
    vi.mocked(describeInstances).mockResolvedValueOnce([mockNode] as never)
    vi.mocked(listQueues).mockRejectedValueOnce(new Error('AccessDenied'))

    const stubClients = {
      ec2: {},
      rds: {},
      s3: {},
      lambda: {},
      alb: {},
      acm: {},
      cloudfront: {},
      apigw: {},
      sqs: {},
      secrets: {},
      ecr: {},
      sns: {},
      dynamo: {},
      ssm: {},
      r53: {},
      sfn: {},
      eventbridge: {},
      iam: {}
    }

    const result = await awsPlugin.scan({ credentials: stubClients, region: 'us-east-1' })
    expect(result.nodes).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].service).toBe('sqs')
    expect(result.errors[0].message).toBe('AccessDenied')
  })

  it('scan() errors include the region', async () => {
    const { listBuckets } = await import('../../aws/services/s3')
    vi.mocked(listBuckets).mockRejectedValueOnce(new Error('NetworkError'))

    const stubClients = {
      ec2: {},
      rds: {},
      s3: {},
      lambda: {},
      alb: {},
      acm: {},
      cloudfront: {},
      apigw: {},
      sqs: {},
      secrets: {},
      ecr: {},
      sns: {},
      dynamo: {},
      ssm: {},
      r53: {},
      sfn: {},
      eventbridge: {},
      iam: {}
    }

    const result = await awsPlugin.scan({ credentials: stubClients, region: 'eu-west-1' })
    const s3Error = result.errors.find((e: { service: string }) => e.service === 's3')
    expect(s3Error).toBeDefined()
    expect(s3Error!.region).toBe('eu-west-1')
  })
})
