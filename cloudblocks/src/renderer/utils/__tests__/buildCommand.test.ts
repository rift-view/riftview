// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildCommands } from '../buildCommand'
import type { VpcParams, Ec2Params, SgParams, S3Params } from '../../types/create'

describe('buildCommands: vpc', () => {
  it('returns one command with correct args', () => {
    const params: VpcParams = {
      resource: 'vpc', name: 'my-vpc', cidr: '10.0.0.0/16', tenancy: 'default',
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('create-vpc')
    expect(cmds[0]).toContain('--cidr-block')
    expect(cmds[0]).toContain('10.0.0.0/16')
    expect(cmds[0]).toContain('--instance-tenancy')
    expect(cmds[0]).toContain('default')
  })

  it('includes name tag', () => {
    const params: VpcParams = {
      resource: 'vpc', name: 'my-vpc', cidr: '10.0.0.0/16', tenancy: 'default',
    }
    const cmd = buildCommands(params)[0].join(' ')
    expect(cmd).toContain('my-vpc')
  })
})

describe('buildCommands: ec2', () => {
  it('returns one command with run-instances', () => {
    const params: Ec2Params = {
      resource: 'ec2', name: 'web', amiId: 'ami-123', instanceType: 't3.micro',
      keyName: 'mykey', subnetId: 'subnet-abc', securityGroupIds: ['sg-1', 'sg-2'],
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('run-instances')
    expect(cmds[0]).toContain('ami-123')
    expect(cmds[0]).toContain('t3.micro')
    expect(cmds[0]).toContain('sg-1')
    expect(cmds[0]).toContain('sg-2')
  })
})

describe('buildCommands: sg', () => {
  it('returns create + one authorize per rule, using --group-id placeholder', () => {
    const params: SgParams = {
      resource: 'sg', name: 'web-sg', description: 'web', vpcId: 'vpc-123',
      inboundRules: [
        { protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' },
        { protocol: 'tcp', fromPort: 80,  toPort: 80,  cidr: '0.0.0.0/0' },
      ],
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(3)
    expect(cmds[0]).toContain('create-security-group')
    expect(cmds[1]).toContain('authorize-security-group-ingress')
    expect(cmds[2]).toContain('authorize-security-group-ingress')
    expect(cmds[1]).toContain('--group-id')
    expect(cmds[1]).toContain('{GroupId}')
  })

  it('returns just create-security-group when no rules', () => {
    const params: SgParams = {
      resource: 'sg', name: 'empty-sg', description: 'd', vpcId: 'vpc-123',
      inboundRules: [],
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('create-security-group')
  })
})

describe('buildCommands: s3', () => {
  it('returns create-bucket + put-public-access-block for non-us-east-1 with blockPublicAccess', () => {
    const params: S3Params = {
      resource: 's3', bucketName: 'my-bucket', region: 'eu-west-1', blockPublicAccess: true,
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(2)
    expect(cmds[0]).toContain('create-bucket')
    expect(cmds[0]).toContain('--create-bucket-configuration')
    expect(cmds[1]).toContain('put-public-access-block')
  })

  it('returns one create-bucket for us-east-1 with no blockPublicAccess', () => {
    const params: S3Params = {
      resource: 's3', bucketName: 'my-bucket', region: 'us-east-1', blockPublicAccess: false,
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('create-bucket')
    expect(cmds[0]).not.toContain('--create-bucket-configuration')
  })
})
