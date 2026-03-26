import { describe, it, expect } from 'vitest'
import { buildCommands } from '../../../src/renderer/utils/buildCommand'
import { buildDeleteCommands } from '../../../src/renderer/utils/buildDeleteCommands'
import type { CreateSubnetParams, CreateIgwParams } from '../../../src/renderer/types/create'
import type { CloudNode } from '../../../src/renderer/types/cloud'

// ---- Subnet create CLI ------------------------------------------------

describe('buildCommands — subnet', () => {
  it('builds create-subnet with required fields', () => {
    const params: CreateSubnetParams = {
      resource: 'subnet',
      vpcId: 'vpc-0abc1234',
      cidrBlock: '10.0.1.0/24',
    }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual([
      'ec2', 'create-subnet',
      '--vpc-id', 'vpc-0abc1234',
      '--cidr-block', '10.0.1.0/24',
    ])
  })

  it('appends --availability-zone when provided', () => {
    const params: CreateSubnetParams = {
      resource: 'subnet',
      vpcId: 'vpc-0abc1234',
      cidrBlock: '10.0.2.0/24',
      availabilityZone: 'us-east-1a',
    }
    const cmds = buildCommands(params)
    expect(cmds[0]).toContain('--availability-zone')
    expect(cmds[0]).toContain('us-east-1a')
  })

  it('does not append --availability-zone when omitted', () => {
    const params: CreateSubnetParams = {
      resource: 'subnet',
      vpcId: 'vpc-0abc1234',
      cidrBlock: '10.0.1.0/24',
    }
    const cmds = buildCommands(params)
    expect(cmds[0]).not.toContain('--availability-zone')
  })
})

// ---- IGW create CLI ---------------------------------------------------

describe('buildCommands — igw', () => {
  it('builds create-internet-gateway without tag when no name', () => {
    const params: CreateIgwParams = { resource: 'igw' }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual(['ec2', 'create-internet-gateway'])
  })

  it('builds create-internet-gateway with tag-specifications when name provided', () => {
    const params: CreateIgwParams = { resource: 'igw', name: 'main-igw' }
    const cmds = buildCommands(params)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toContain('--tag-specifications')
    expect(cmds[0].join(' ')).toContain('main-igw')
  })
})

// ---- Subnet delete CLI ------------------------------------------------

describe('buildDeleteCommands — subnet', () => {
  const subnetNode: CloudNode = {
    id: 'subnet-0abc1234',
    type: 'subnet',
    label: 'public-1',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
  }

  it('builds delete-subnet command', () => {
    const cmds = buildDeleteCommands(subnetNode)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual(['ec2', 'delete-subnet', '--subnet-id', 'subnet-0abc1234'])
  })
})

// ---- IGW delete CLI ---------------------------------------------------

describe('buildDeleteCommands — igw', () => {
  it('builds detach + delete when parentId is set', () => {
    const igwNode: CloudNode = {
      id: 'igw-0abc1234',
      type: 'igw',
      label: 'main-igw',
      status: 'running',
      region: 'us-east-1',
      metadata: {},
      parentId: 'vpc-0abc1234',
    }
    const cmds = buildDeleteCommands(igwNode)
    expect(cmds).toHaveLength(2)
    expect(cmds[0]).toEqual([
      'ec2', 'detach-internet-gateway',
      '--internet-gateway-id', 'igw-0abc1234',
      '--vpc-id', 'vpc-0abc1234',
    ])
    expect(cmds[1]).toEqual([
      'ec2', 'delete-internet-gateway',
      '--internet-gateway-id', 'igw-0abc1234',
    ])
  })

  it('builds only delete when no VPC attachment', () => {
    const igwNode: CloudNode = {
      id: 'igw-detached',
      type: 'igw',
      label: 'unattached-igw',
      status: 'unknown',
      region: 'us-east-1',
      metadata: {},
    }
    const cmds = buildDeleteCommands(igwNode)
    expect(cmds).toHaveLength(1)
    expect(cmds[0]).toEqual([
      'ec2', 'delete-internet-gateway',
      '--internet-gateway-id', 'igw-detached',
    ])
  })

  it('falls back to metadata.vpcId when parentId is absent', () => {
    const igwNode: CloudNode = {
      id: 'igw-meta',
      type: 'igw',
      label: 'meta-igw',
      status: 'running',
      region: 'us-east-1',
      metadata: { vpcId: 'vpc-from-meta' },
    }
    const cmds = buildDeleteCommands(igwNode)
    expect(cmds).toHaveLength(2)
    expect(cmds[0]).toContain('vpc-from-meta')
  })
})
