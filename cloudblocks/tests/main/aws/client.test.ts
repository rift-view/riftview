import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all AWS SDK clients before importing client.ts
vi.mock('@aws-sdk/client-ec2', () => {
  const EC2Client = vi.fn(function(this: { send: ReturnType<typeof vi.fn> }) {
    this.send = vi.fn()
  })
  return { EC2Client }
})
vi.mock('@aws-sdk/client-rds', () => {
  const RDSClient = vi.fn(function(this: { send: ReturnType<typeof vi.fn> }) {
    this.send = vi.fn()
  })
  return { RDSClient }
})
vi.mock('@aws-sdk/client-s3', () => {
  const S3Client = vi.fn(function(this: { send: ReturnType<typeof vi.fn> }) {
    this.send = vi.fn()
  })
  return { S3Client }
})
vi.mock('@aws-sdk/client-lambda', () => {
  const LambdaClient = vi.fn(function(this: { send: ReturnType<typeof vi.fn> }) {
    this.send = vi.fn()
  })
  return { LambdaClient }
})
vi.mock('@aws-sdk/client-elastic-load-balancing-v2', () => {
  const ElasticLoadBalancingV2Client = vi.fn(function(this: { send: ReturnType<typeof vi.fn> }) {
    this.send = vi.fn()
  })
  return { ElasticLoadBalancingV2Client }
})

import { createClients, type AwsClients } from '../../../src/main/aws/client'

describe('createClients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all required SDK client types', () => {
    const clients: AwsClients = createClients('default', 'us-east-1')
    expect(clients.ec2).toBeDefined()
    expect(clients.rds).toBeDefined()
    expect(clients.s3).toBeDefined()
    expect(clients.lambda).toBeDefined()
    expect(clients.alb).toBeDefined()
  })

  it('creates clients with the given region', async () => {
    const { EC2Client } = await import('@aws-sdk/client-ec2')
    createClients('default', 'eu-west-1')
    expect(EC2Client).toHaveBeenCalledWith(expect.objectContaining({ region: 'eu-west-1' }))
  })
})
