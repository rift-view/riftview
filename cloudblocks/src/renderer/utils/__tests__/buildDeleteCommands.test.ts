import { describe, it, expect } from 'vitest'
import { buildDeleteCommands, buildQuickActionCommand } from '../buildDeleteCommands'
import type { CloudNode } from '../../types/cloud'

function node(type: CloudNode['type'], id: string, status: CloudNode['status'] = 'running'): CloudNode {
  return { id, type, label: id, status, region: 'us-east-1', metadata: {} }
}

describe('buildDeleteCommands', () => {
  it('VPC delete', () => {
    expect(buildDeleteCommands(node('vpc', 'vpc-123'))).toEqual([
      ['ec2', 'delete-vpc', '--vpc-id', 'vpc-123'],
    ])
  })
  it('EC2 terminate', () => {
    expect(buildDeleteCommands(node('ec2', 'i-abc'))).toEqual([
      ['ec2', 'terminate-instances', '--instance-ids', 'i-abc'],
    ])
  })
  it('SG delete', () => {
    expect(buildDeleteCommands(node('security-group', 'sg-xyz'))).toEqual([
      ['ec2', 'delete-security-group', '--group-id', 'sg-xyz'],
    ])
  })
  it('RDS delete without final snapshot', () => {
    expect(buildDeleteCommands(node('rds', 'mydb'), { skipFinalSnapshot: true })).toEqual([
      ['rds', 'delete-db-instance', '--db-instance-identifier', 'mydb', '--skip-final-snapshot'],
    ])
  })
  it('S3 delete with force', () => {
    expect(buildDeleteCommands(node('s3', 'my-bucket'), { force: true })).toEqual([
      ['s3', 'rb', 's3://my-bucket', '--force'],
    ])
  })
  it('Lambda delete', () => {
    expect(buildDeleteCommands(node('lambda', 'my-fn'))).toEqual([
      ['lambda', 'delete-function', '--function-name', 'my-fn'],
    ])
  })
  it('ALB delete', () => {
    expect(buildDeleteCommands(node('alb', 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-alb/abc'))).toEqual([
      ['elbv2', 'delete-load-balancer', '--load-balancer-arn', 'arn:aws:elasticloadbalancing:us-east-1:123:loadbalancer/app/my-alb/abc'],
    ])
  })
  it('R53 hosted zone delete', () => {
    expect(buildDeleteCommands(node('r53-zone', '/hostedzone/Z1234567890ABC'))).toEqual([
      ['route53', 'delete-hosted-zone', '--id', '/hostedzone/Z1234567890ABC'],
    ])
  })
  it('SSM Parameter delete by name (label)', () => {
    const n: CloudNode = {
      id: 'arn:aws:ssm:us-east-1:123:parameter/my/key',
      type: 'ssm-param',
      label: '/my/key',
      status: 'running',
      region: 'us-east-1',
      metadata: { type: 'String', tier: 'Standard' },
    }
    expect(buildDeleteCommands(n)).toEqual([
      ['ssm', 'delete-parameter', '--name', '/my/key'],
    ])
  })
})

describe('buildQuickActionCommand', () => {
  it('EC2 stop', () => {
    expect(buildQuickActionCommand(node('ec2', 'i-123'), 'stop')).toEqual([
      ['ec2', 'stop-instances', '--instance-ids', 'i-123'],
    ])
  })
  it('EC2 start', () => {
    expect(buildQuickActionCommand(node('ec2', 'i-123'), 'start')).toEqual([
      ['ec2', 'start-instances', '--instance-ids', 'i-123'],
    ])
  })
  it('EC2 reboot', () => {
    expect(buildQuickActionCommand(node('ec2', 'i-123'), 'reboot')).toEqual([
      ['ec2', 'reboot-instances', '--instance-ids', 'i-123'],
    ])
  })
  it('RDS stop', () => {
    expect(buildQuickActionCommand(node('rds', 'mydb'), 'stop')).toEqual([
      ['rds', 'stop-db-instance', '--db-instance-identifier', 'mydb'],
    ])
  })
  it('RDS start', () => {
    expect(buildQuickActionCommand(node('rds', 'mydb'), 'start')).toEqual([
      ['rds', 'start-db-instance', '--db-instance-identifier', 'mydb'],
    ])
  })
  it('RDS reboot', () => {
    expect(buildQuickActionCommand(node('rds', 'mydb'), 'reboot')).toEqual([
      ['rds', 'reboot-db-instance', '--db-instance-identifier', 'mydb'],
    ])
  })
  it('returns empty array for unsupported type', () => {
    expect(buildQuickActionCommand(node('vpc', 'vpc-1'), 'stop')).toEqual([])
  })
})
