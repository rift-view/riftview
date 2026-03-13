import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  DescribeKeyPairsCommand,
  type Instance,
} from '@aws-sdk/client-ec2'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function nameTag(tags: { Key?: string; Value?: string }[] | undefined): string | undefined {
  return tags?.find((t) => t.Key === 'Name')?.Value
}

function ec2StatusToNodeStatus(state: string | undefined): NodeStatus {
  switch (state) {
    case 'running':   return 'running'
    case 'stopped':   return 'stopped'
    case 'pending':
    case 'stopping':  return 'pending'
    default:          return 'unknown'
  }
}

export async function describeInstances(client: EC2Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeInstancesCommand({}))
    const instances: Instance[] = res.Reservations?.flatMap((r) => r.Instances ?? []) ?? []
    return instances.map((i): CloudNode => ({
      id:       i.InstanceId ?? 'unknown',
      type:     'ec2',
      label:    nameTag(i.Tags) ?? i.InstanceId ?? 'EC2',
      status:   ec2StatusToNodeStatus(i.State?.Name),
      region,
      metadata: { instanceType: i.InstanceType, vpcId: i.VpcId, subnetId: i.SubnetId },
      parentId: i.SubnetId,
    }))
  } catch {
    return []
  }
}

export async function describeVpcs(client: EC2Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeVpcsCommand({}))
    return (res.Vpcs ?? []).map((v): CloudNode => ({
      id:       v.VpcId ?? 'unknown',
      type:     'vpc',
      label:    nameTag(v.Tags) ?? v.VpcId ?? 'VPC',
      status:   v.State === 'available' ? 'running' : 'pending',
      region,
      metadata: { cidrBlock: v.CidrBlock, isDefault: v.IsDefault },
    }))
  } catch {
    return []
  }
}

export async function describeSubnets(client: EC2Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeSubnetsCommand({}))
    return (res.Subnets ?? []).map((s): CloudNode => ({
      id:       s.SubnetId ?? 'unknown',
      type:     'subnet',
      label:    nameTag(s.Tags) ?? s.SubnetId ?? 'Subnet',
      status:   s.State === 'available' ? 'running' : 'pending',
      region,
      metadata: { cidrBlock: s.CidrBlock, availabilityZone: s.AvailabilityZone, mapPublicIp: s.MapPublicIpOnLaunch },
      parentId: s.VpcId,
    }))
  } catch {
    return []
  }
}

export async function describeSecurityGroups(client: EC2Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeSecurityGroupsCommand({}))
    return (res.SecurityGroups ?? []).map((sg): CloudNode => ({
      id:       sg.GroupId ?? 'unknown',
      type:     'security-group',
      label:    sg.GroupName ?? sg.GroupId ?? 'SG',
      status:   'running',
      region,
      metadata: { description: sg.Description, vpcId: sg.VpcId },
      parentId: sg.VpcId,
    }))
  } catch {
    return []
  }
}

export async function describeKeyPairs(client: EC2Client): Promise<string[]> {
  try {
    const { KeyPairs } = await client.send(new DescribeKeyPairsCommand({}))
    return (KeyPairs ?? []).map(kp => kp.KeyName ?? '').filter(Boolean)
  } catch {
    return []
  }
}
