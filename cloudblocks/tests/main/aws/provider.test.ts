import { describe, it, expect, vi } from 'vitest'
import { awsProvider } from '../../../src/main/aws/provider'
import type { AwsClients } from '../../../src/main/aws/client'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

vi.mock('../../../src/main/aws/services/ec2', () => ({
  describeInstances:      vi.fn().mockResolvedValue([]),
  describeVpcs:           vi.fn().mockResolvedValue([]),
  describeSubnets:        vi.fn().mockResolvedValue([]),
  describeSecurityGroups: vi.fn().mockResolvedValue([]),
  describeKeyPairs:       vi.fn().mockResolvedValue([]),
}))
vi.mock('../../../src/main/aws/services/igw',        () => ({ listInternetGateways: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/nat',        () => ({ listNatGateways:       vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/rds',        () => ({ describeDBInstances:   vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/s3',         () => ({ listBuckets:           vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/lambda',     () => ({ listFunctions:         vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/alb',        () => ({ describeLoadBalancers: vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/acm',        () => ({ listCertificates:      vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/cloudfront', () => ({ listDistributions:     vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/apigw',      () => ({ listApis:              vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/sqs',        () => ({ listQueues:            vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/secrets',    () => ({ listSecrets:           vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/ecr',        () => ({ listRepositories:      vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/sns',        () => ({ listTopics:            vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/dynamo',     () => ({ listTables:            vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/ssm',        () => ({ listParameters:        vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/r53',        () => ({ listHostedZones:       vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/sfn',        () => ({ listStateMachines:     vi.fn().mockResolvedValue([]) }))
vi.mock('../../../src/main/aws/services/eventbridge',() => ({ listEventBuses:        vi.fn().mockResolvedValue([]) }))

const stubClients = {} as AwsClients

describe('awsProvider.scan — scanErrors', () => {
  it('returns empty scanErrors when all services succeed', async () => {
    const result = await awsProvider.scan(stubClients, 'us-east-1')
    expect(result.scanErrors).toEqual([])
  })

  it('returns a ScanError entry when a service throws', async () => {
    const { listQueues } = await import('../../../src/main/aws/services/sqs')
    vi.mocked(listQueues).mockRejectedValueOnce(new Error('AccessDenied'))

    const result = await awsProvider.scan(stubClients, 'us-east-1')
    expect(result.nodes).toBeDefined()
    expect(result.scanErrors).toHaveLength(1)
    expect(result.scanErrors[0].service).toBe('sqs')
    expect(result.scanErrors[0].region).toBe('us-east-1')
    expect(result.scanErrors[0].message).toBe('AccessDenied')
  })

  it('collects errors from multiple failing services without dropping nodes from healthy ones', async () => {
    const { listQueues }       = await import('../../../src/main/aws/services/sqs')
    const { listRepositories } = await import('../../../src/main/aws/services/ecr')
    vi.mocked(listQueues).mockRejectedValueOnce(new Error('ThrottlingException'))
    vi.mocked(listRepositories).mockRejectedValueOnce(new Error('AccessDenied'))

    const result = await awsProvider.scan(stubClients, 'eu-west-1')
    const serviceNames = result.scanErrors.map((e) => e.service)
    expect(serviceNames).toContain('sqs')
    expect(serviceNames).toContain('ecr')
    expect(result.scanErrors).toHaveLength(2)
    result.scanErrors.forEach((e) => expect(e.region).toBe('eu-west-1'))
  })

  it('uses String(e) as message when error has no .message property', async () => {
    const { listHostedZones } = await import('../../../src/main/aws/services/r53')
    vi.mocked(listHostedZones).mockRejectedValueOnce('plain string rejection')

    const result = await awsProvider.scan(stubClients, 'us-east-1')
    const r53Error = result.scanErrors.find((e) => e.service === 'r53')
    expect(r53Error).toBeDefined()
    expect(r53Error!.message).toBe('plain string rejection')
  })
})
