import { describe, it, expect } from 'vitest'
import { buildEditCommands } from '../buildEditCommands'
import type { CloudNode } from '../../types/cloud'

function node(type: CloudNode['type'], id: string, status: CloudNode['status'] = 'running', metadata: Record<string, unknown> = {}): CloudNode {
  return { id, type, label: id, status, region: 'us-east-1', metadata }
}

describe('buildEditCommands — VPC', () => {
  it('emits create-tags for name change', () => {
    expect(buildEditCommands(node('vpc', 'vpc-123'), { resource: 'vpc', name: 'my-vpc' })).toEqual([
      ['ec2', 'create-tags', '--resources', 'vpc-123', '--tags', 'Key=Name,Value=my-vpc'],
    ])
  })
})

describe('buildEditCommands — EC2', () => {
  it('name tag only', () => {
    expect(buildEditCommands(node('ec2', 'i-123'), { resource: 'ec2', name: 'web-server' })).toEqual([
      ['ec2', 'create-tags', '--resources', 'i-123', '--tags', 'Key=Name,Value=web-server'],
    ])
  })

  it('instance type change on running instance: stop + modify + start', () => {
    const cmds = buildEditCommands(node('ec2', 'i-123', 'running'), { resource: 'ec2', instanceType: 't3.large' })
    expect(cmds).toEqual([
      ['ec2', 'stop-instances', '--instance-ids', 'i-123'],
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-123', '--instance-type', 'Value=t3.large'],
      ['ec2', 'start-instances', '--instance-ids', 'i-123'],
    ])
  })

  it('instance type change on stopped instance: modify only, no start', () => {
    const cmds = buildEditCommands(node('ec2', 'i-123', 'stopped'), { resource: 'ec2', instanceType: 't3.large' })
    expect(cmds).toEqual([
      ['ec2', 'modify-instance-attribute', '--instance-id', 'i-123', '--instance-type', 'Value=t3.large'],
    ])
  })
})

describe('buildEditCommands — SG (rule diffing)', () => {
  const existingRules = [
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidr: '0.0.0.0/0' },
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidr: '10.0.0.0/8' },
  ]

  it('authorizes new rules', () => {
    const cmds = buildEditCommands(
      node('security-group', 'sg-abc', 'running', { rules: existingRules }),
      { resource: 'sg', rules: [...existingRules, { protocol: 'tcp', fromPort: 80, toPort: 80, cidr: '0.0.0.0/0' }] }
    )
    expect(cmds).toEqual([
      ['ec2', 'authorize-security-group-ingress', '--group-id', 'sg-abc', '--ip-permissions',
       'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]'],
    ])
  })

  it('revokes removed rules before authorizing new ones', () => {
    const newRules = [existingRules[0]] // only keep the 443 rule
    const cmds = buildEditCommands(
      node('security-group', 'sg-abc', 'running', { rules: existingRules }),
      { resource: 'sg', rules: newRules }
    )
    expect(cmds).toEqual([
      ['ec2', 'revoke-security-group-ingress', '--group-id', 'sg-abc', '--ip-permissions',
       'IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=10.0.0.0/8}]'],
    ])
  })

  it('returns empty array when rules unchanged', () => {
    expect(buildEditCommands(
      node('security-group', 'sg-abc', 'running', { rules: existingRules }),
      { resource: 'sg', rules: existingRules }
    )).toEqual([])
  })
})

describe('buildEditCommands — RDS', () => {
  it('modifies instance class', () => {
    const cmds = buildEditCommands(node('rds', 'mydb'), { resource: 'rds', dbInstanceClass: 'db.t3.small' })
    expect(cmds[0]).toEqual(['rds', 'modify-db-instance', '--db-instance-identifier', 'mydb', '--apply-immediately', '--db-instance-class', 'db.t3.small'])
  })

  it('enables deletion protection', () => {
    const cmds = buildEditCommands(node('rds', 'mydb'), { resource: 'rds', deletionProtection: true })
    expect(cmds[0]).toContain('--deletion-protection')
    expect(cmds[0]).not.toContain('--no-deletion-protection')
  })

  it('disables deletion protection', () => {
    const cmds = buildEditCommands(node('rds', 'mydb'), { resource: 'rds', deletionProtection: false })
    expect(cmds[0]).toContain('--no-deletion-protection')
  })
})

describe('buildEditCommands — S3', () => {
  it('enables versioning', () => {
    expect(buildEditCommands(node('s3', 'my-bucket'), { resource: 's3', versioning: true })).toEqual([
      ['s3api', 'put-bucket-versioning', '--bucket', 'my-bucket', '--versioning-configuration', 'Status=Enabled'],
    ])
  })
  it('suspends versioning', () => {
    expect(buildEditCommands(node('s3', 'my-bucket'), { resource: 's3', versioning: false })).toEqual([
      ['s3api', 'put-bucket-versioning', '--bucket', 'my-bucket', '--versioning-configuration', 'Status=Suspended'],
    ])
  })
  it('sets public access block', () => {
    const cmds = buildEditCommands(node('s3', 'my-bucket'), { resource: 's3', blockPublicAccess: true })
    expect(cmds[0][0]).toBe('s3api')
    expect(cmds[0][1]).toBe('put-public-access-block')
  })
})

describe('buildEditCommands — Lambda', () => {
  it('updates memory and timeout', () => {
    const cmds = buildEditCommands(node('lambda', 'my-fn'), { resource: 'lambda', memorySize: 256, timeout: 10 })
    expect(cmds[0]).toEqual(['lambda', 'update-function-configuration', '--function-name', 'my-fn', '--memory-size', '256', '--timeout', '10'])
  })
  it('updates environment variables', () => {
    const cmds = buildEditCommands(node('lambda', 'my-fn'), { resource: 'lambda', environment: { KEY: 'value' } })
    expect(cmds[0]).toContain('--environment')
  })
})

describe('buildEditCommands — ALB', () => {
  it('adds name tag', () => {
    expect(buildEditCommands(node('alb', 'arn:aws:alb'), { resource: 'alb', name: 'my-alb' })).toEqual([
      ['elbv2', 'add-tags', '--resource-arns', 'arn:aws:alb', '--tags', 'Key=Name,Value=my-alb'],
    ])
  })
})

describe('buildEditCommands — SQS', () => {
  it('emits set-queue-attributes with visibility timeout and retention period', () => {
    expect(buildEditCommands(
      node('sqs', 'https://sqs.us-east-1.amazonaws.com/123/my-queue'),
      { resource: 'sqs', queueUrl: 'https://sqs.us-east-1.amazonaws.com/123/my-queue', visibilityTimeout: 60, messageRetentionPeriod: 86400 }
    )).toEqual([
      ['sqs', 'set-queue-attributes', '--queue-url', 'https://sqs.us-east-1.amazonaws.com/123/my-queue',
        '--attributes', 'VisibilityTimeout=60,MessageRetentionPeriod=86400'],
    ])
  })
})

describe('buildEditCommands — SNS', () => {
  it('emits set-topic-attributes with DisplayName', () => {
    expect(buildEditCommands(
      node('sns', 'arn:aws:sns:us-east-1:123:my-topic'),
      { resource: 'sns', topicArn: 'arn:aws:sns:us-east-1:123:my-topic', displayName: 'MySender' }
    )).toEqual([
      ['sns', 'set-topic-attributes', '--topic-arn', 'arn:aws:sns:us-east-1:123:my-topic',
        '--attribute-name', 'DisplayName', '--attribute-value', 'MySender'],
    ])
  })

  it('allows empty display name', () => {
    const cmds = buildEditCommands(
      node('sns', 'arn:aws:sns:us-east-1:123:my-topic'),
      { resource: 'sns', topicArn: 'arn:aws:sns:us-east-1:123:my-topic', displayName: '' }
    )
    expect(cmds[0]).toEqual(['sns', 'set-topic-attributes', '--topic-arn', 'arn:aws:sns:us-east-1:123:my-topic',
      '--attribute-name', 'DisplayName', '--attribute-value', ''])
  })
})

describe('buildEditCommands — ECR', () => {
  it('emits two commands: put-image-tag-mutability and put-image-scanning-configuration', () => {
    const cmds = buildEditCommands(
      node('ecr-repo', 'arn:aws:ecr:us-east-1:123:repository/my-repo'),
      { resource: 'ecr-repo', repositoryName: 'my-repo', imageTagMutability: 'IMMUTABLE', scanOnPush: true }
    )
    expect(cmds).toHaveLength(2)
    expect(cmds[0]).toEqual(['ecr', 'put-image-tag-mutability', '--repository-name', 'my-repo', '--image-tag-mutability', 'IMMUTABLE'])
    expect(cmds[1]).toEqual(['ecr', 'put-image-scanning-configuration', '--repository-name', 'my-repo', '--image-scanning-configuration', 'scanOnPush=true'])
  })

  it('emits MUTABLE and scanOnPush=false', () => {
    const cmds = buildEditCommands(
      node('ecr-repo', 'arn:aws:ecr:us-east-1:123:repository/my-repo'),
      { resource: 'ecr-repo', repositoryName: 'my-repo', imageTagMutability: 'MUTABLE', scanOnPush: false }
    )
    expect(cmds[0]).toContain('MUTABLE')
    expect(cmds[1]).toContain('scanOnPush=false')
  })
})

describe('buildEditCommands — Secret', () => {
  it('emits update-secret with description', () => {
    expect(buildEditCommands(
      node('secret', 'arn:aws:secretsmanager:us-east-1:123:secret/my-secret'),
      { resource: 'secret', secretId: 'arn:aws:secretsmanager:us-east-1:123:secret/my-secret', description: 'My secret' }
    )).toEqual([
      ['secretsmanager', 'update-secret', '--secret-id', 'arn:aws:secretsmanager:us-east-1:123:secret/my-secret',
        '--description', 'My secret'],
    ])
  })

  it('allows empty description', () => {
    const cmds = buildEditCommands(
      node('secret', 'arn:aws:secretsmanager:us-east-1:123:secret/my-secret'),
      { resource: 'secret', secretId: 'arn:aws:secretsmanager:us-east-1:123:secret/my-secret', description: '' }
    )
    expect(cmds[0]).toEqual(['secretsmanager', 'update-secret', '--secret-id',
      'arn:aws:secretsmanager:us-east-1:123:secret/my-secret', '--description', ''])
  })
})

describe('buildEditCommands — EventBridge', () => {
  it('emits update-event-bus with bus name and description', () => {
    const n = { ...node('eventbridge-bus', 'arn:aws:events:us-east-1:123:event-bus/my-bus'), label: 'my-bus' }
    expect(buildEditCommands(n, { resource: 'eventbridge-bus', busName: 'my-bus', description: 'My event bus' })).toEqual([
      ['events', 'update-event-bus', '--name', 'my-bus', '--description', 'My event bus'],
    ])
  })

  it('emits empty description when not provided', () => {
    const n = { ...node('eventbridge-bus', 'arn:aws:events:us-east-1:123:event-bus/my-bus'), label: 'my-bus' }
    const cmds = buildEditCommands(n, { resource: 'eventbridge-bus', busName: 'my-bus', description: '' })
    expect(cmds[0]).toEqual(['events', 'update-event-bus', '--name', 'my-bus', '--description', ''])
  })
})
