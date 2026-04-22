import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

vi.mock('@riftview/cloud-scan', () => ({
  createClients: vi.fn().mockReturnValue({ stubClient: true }),
  describeInstances: vi.fn().mockResolvedValue([]),
  describeVpcs: vi.fn().mockResolvedValue([]),
  describeSubnets: vi.fn().mockResolvedValue([]),
  describeSecurityGroups: vi.fn().mockResolvedValue([]),
  describeKeyPairs: vi.fn().mockResolvedValue([]),
  listInternetGateways: vi.fn().mockResolvedValue([]),
  listNatGateways: vi.fn().mockResolvedValue([]),
  describeDBInstances: vi.fn().mockResolvedValue([]),
  listBuckets: vi.fn().mockResolvedValue([]),
  listFunctions: vi.fn().mockResolvedValue([]),
  describeLoadBalancers: vi.fn().mockResolvedValue([]),
  listCertificates: vi.fn().mockResolvedValue([]),
  listDistributions: vi.fn().mockResolvedValue([]),
  listApis: vi.fn().mockResolvedValue([]),
  listQueues: vi.fn().mockResolvedValue([]),
  listSecrets: vi.fn().mockResolvedValue([]),
  listRepositories: vi.fn().mockResolvedValue([]),
  listTopics: vi.fn().mockResolvedValue([]),
  listTables: vi.fn().mockResolvedValue([]),
  listParameters: vi.fn().mockResolvedValue([]),
  listHostedZones: vi.fn().mockResolvedValue([]),
  listStateMachines: vi.fn().mockResolvedValue([]),
  listEventBuses: vi.fn().mockResolvedValue([]),
  listIdentities: vi.fn().mockResolvedValue([]),
  listUserPools: vi.fn().mockResolvedValue([]),
  listStreams: vi.fn().mockResolvedValue([]),
  listEcsServices: vi.fn().mockResolvedValue([]),
  listCacheClusters: vi.fn().mockResolvedValue([]),
  listEksClusters: vi.fn().mockResolvedValue([]),
  listOpenSearchDomains: vi.fn().mockResolvedValue([]),
  listMskClusters: vi.fn().mockResolvedValue([])
}))

const ALL_NODE_TYPES = [
  'ec2',
  'vpc',
  'subnet',
  'rds',
  's3',
  'lambda',
  'alb',
  'security-group',
  'igw',
  'acm',
  'cloudfront',
  'apigw',
  'apigw-route',
  'sqs',
  'secret',
  'ecr-repo',
  'sns',
  'dynamo',
  'ssm-param',
  'nat-gateway',
  'r53-zone',
  'sfn',
  'eventbridge-bus',
  'ses',
  'cognito',
  'kinesis',
  'ecs',
  'elasticache',
  'eks',
  'opensearch',
  'msk',
  'unknown'
] as const

describe('awsPlugin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let awsPlugin: any

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../../src/main/plugin/awsPlugin')
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
    for (const t of awsPlugin.nodeTypes as string[]) {
      const meta = awsPlugin.nodeTypeMetadata[t]
      expect(meta, `missing metadata for ${t}`).toBeDefined()
      expect(typeof meta.label).toBe('string')
      expect(typeof meta.borderColor).toBe('string')
      expect(typeof meta.badgeColor).toBe('string')
      expect(typeof meta.shortLabel).toBe('string')
      expect(typeof meta.displayName).toBe('string')
      expect(typeof meta.hasCreate).toBe('boolean')
    }
  })

  it('createCredentials calls createClients and returns clients', async () => {
    const { createClients } = await import('@riftview/cloud-scan')
    const result = awsPlugin.createCredentials('default', 'us-east-1')
    expect(createClients).toHaveBeenCalledWith('default', 'us-east-1', undefined)
    expect(result).toEqual({ stubClient: true })
  })

  it('createCredentials passes endpoint when provided', async () => {
    const { createClients } = await import('@riftview/cloud-scan')
    awsPlugin.createCredentials('default', 'us-east-1', 'http://localhost:4566')
    expect(createClients).toHaveBeenCalledWith('default', 'us-east-1', 'http://localhost:4566')
  })

  it('scan() returns merged nodes from all services', async () => {
    const { describeInstances } = await import('@riftview/cloud-scan')
    const mockNode = {
      id: 'i-123',
      type: 'ec2',
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
    const { listQueues, describeInstances } = await import('@riftview/cloud-scan')
    const mockNode = {
      id: 'i-456',
      type: 'ec2',
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
    const { listBuckets } = await import('@riftview/cloud-scan')
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
