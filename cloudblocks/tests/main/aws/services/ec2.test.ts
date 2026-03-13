import { describe, it, expect, vi } from 'vitest'
import { EC2Client } from '@aws-sdk/client-ec2'
import { describeInstances, describeVpcs, describeSubnets, describeSecurityGroups } from '../../../../src/main/aws/services/ec2'
import type { CloudNode } from '../../../../src/renderer/types/cloud'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as EC2Client

describe('describeInstances', () => {
  it('maps EC2 instances to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      Reservations: [{
        Instances: [{
          InstanceId: 'i-0abc123',
          InstanceType: 't3.micro',
          State: { Name: 'running' },
          VpcId: 'vpc-0abc',
          SubnetId: 'subnet-0abc',
          Tags: [{ Key: 'Name', Value: 'web-server' }],
        }],
      }],
    })

    const nodes: CloudNode[] = await describeInstances(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('i-0abc123')
    expect(nodes[0].type).toBe('ec2')
    expect(nodes[0].label).toBe('web-server')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].parentId).toBe('subnet-0abc')
  })

  it('uses InstanceId as label when no Name tag', async () => {
    mockSend.mockResolvedValueOnce({
      Reservations: [{ Instances: [{ InstanceId: 'i-0xyz', State: { Name: 'stopped' }, Tags: [] }] }],
    })
    const nodes = await describeInstances(mockClient, 'us-east-1')
    expect(nodes[0].label).toBe('i-0xyz')
    expect(nodes[0].status).toBe('stopped')
  })

  it('returns empty array on SDK error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))
    const nodes = await describeInstances(mockClient, 'us-east-1')
    expect(nodes).toEqual([])
  })
})

describe('describeVpcs', () => {
  it('maps VPCs to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      Vpcs: [{ VpcId: 'vpc-0abc', State: 'available', CidrBlock: '10.0.0.0/16', Tags: [{ Key: 'Name', Value: 'main-vpc' }] }],
    })
    const nodes = await describeVpcs(mockClient, 'us-east-1')
    expect(nodes[0].type).toBe('vpc')
    expect(nodes[0].label).toBe('main-vpc')
    expect(nodes[0].status).toBe('running')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))
    expect(await describeVpcs(mockClient, 'us-east-1')).toEqual([])
  })
})

describe('describeSubnets', () => {
  it('maps subnets to CloudNodes with parentId=VpcId', async () => {
    mockSend.mockResolvedValueOnce({
      Subnets: [{ SubnetId: 'subnet-0abc', State: 'available', VpcId: 'vpc-0abc', CidrBlock: '10.0.1.0/24', Tags: [{ Key: 'Name', Value: 'public-1' }] }],
    })
    const nodes = await describeSubnets(mockClient, 'us-east-1')
    expect(nodes[0].type).toBe('subnet')
    expect(nodes[0].label).toBe('public-1')
    expect(nodes[0].parentId).toBe('vpc-0abc')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('err'))
    expect(await describeSubnets(mockClient, 'us-east-1')).toEqual([])
  })
})

describe('describeSecurityGroups', () => {
  it('maps security groups to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      SecurityGroups: [{ GroupId: 'sg-0abc', GroupName: 'sg-web', VpcId: 'vpc-0abc', Description: 'web sg' }],
    })
    const nodes = await describeSecurityGroups(mockClient, 'us-east-1')
    expect(nodes[0].type).toBe('security-group')
    expect(nodes[0].label).toBe('sg-web')
    expect(nodes[0].parentId).toBe('vpc-0abc')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('err'))
    expect(await describeSecurityGroups(mockClient, 'us-east-1')).toEqual([])
  })
})
