import type { CloudNode } from '../types/cloud'
import type { EditParams, SgRule, ApigwEditParams } from '../types/edit'

function ruleKey(r: SgRule): string {
  return `${r.protocol}:${r.fromPort}:${r.toPort}:${r.cidr}`
}

function formatPermission(r: SgRule): string {
  return `IpProtocol=${r.protocol},FromPort=${r.fromPort},ToPort=${r.toPort},IpRanges=[{CidrIp=${r.cidr}}]`
}

export function buildEditCommands(node: CloudNode, params: EditParams): string[][] {
  switch (params.resource) {
    case 'vpc':
      return [['ec2', 'create-tags', '--resources', node.id, '--tags', `Key=Name,Value=${params.name}`]]

    case 'ec2': {
      const cmds: string[][] = []
      if (params.instanceType) {
        const isRunning = node.status === 'running'
        if (isRunning) cmds.push(['ec2', 'stop-instances', '--instance-ids', node.id])
        cmds.push(['ec2', 'modify-instance-attribute', '--instance-id', node.id, '--instance-type', `Value=${params.instanceType}`])
        if (isRunning) cmds.push(['ec2', 'start-instances', '--instance-ids', node.id])
      }
      if (params.name) {
        cmds.push(['ec2', 'create-tags', '--resources', node.id, '--tags', `Key=Name,Value=${params.name}`])
      }
      if (params.securityGroupIds && params.securityGroupIds.length > 0) {
        cmds.push(['ec2', 'modify-instance-attribute', '--instance-id', node.id, '--groups', ...params.securityGroupIds])
      }
      return cmds
    }

    case 'sg': {
      const existing: SgRule[] = (node.metadata.rules as SgRule[]) || []
      const existingKeys = new Set(existing.map(ruleKey))
      const newKeys = new Set(params.rules.map(ruleKey))
      const toRevoke = existing.filter(r => !newKeys.has(ruleKey(r)))
      const toAuthorize = params.rules.filter(r => !existingKeys.has(ruleKey(r)))
      const cmds: string[][] = []
      for (const r of toRevoke) {
        cmds.push(['ec2', 'revoke-security-group-ingress', '--group-id', node.id, '--ip-permissions', formatPermission(r)])
      }
      for (const r of toAuthorize) {
        cmds.push(['ec2', 'authorize-security-group-ingress', '--group-id', node.id, '--ip-permissions', formatPermission(r)])
      }
      return cmds
    }

    case 'rds': {
      const args = ['rds', 'modify-db-instance', '--db-instance-identifier', node.id, '--apply-immediately']
      if (params.dbInstanceClass) args.push('--db-instance-class', params.dbInstanceClass)
      if (params.multiAZ === true)  args.push('--multi-az')
      if (params.multiAZ === false) args.push('--no-multi-az')
      if (params.deletionProtection === true)  args.push('--deletion-protection')
      if (params.deletionProtection === false) args.push('--no-deletion-protection')
      return [args]
    }

    case 's3': {
      const cmds: string[][] = []
      if (params.versioning !== undefined) {
        cmds.push(['s3api', 'put-bucket-versioning', '--bucket', node.id,
          '--versioning-configuration', `Status=${params.versioning ? 'Enabled' : 'Suspended'}`])
      }
      if (params.blockPublicAccess !== undefined) {
        const v = String(params.blockPublicAccess)
        cmds.push(['s3api', 'put-public-access-block', '--bucket', node.id,
          '--public-access-block-configuration',
          `BlockPublicAcls=${v},IgnorePublicAcls=${v},BlockPublicPolicy=${v},RestrictPublicBuckets=${v}`])
      }
      return cmds
    }

    case 'lambda': {
      const args = ['lambda', 'update-function-configuration', '--function-name', node.id]
      if (params.memorySize) args.push('--memory-size', String(params.memorySize))
      if (params.timeout)    args.push('--timeout', String(params.timeout))
      if (params.environment) {
        const vars = Object.entries(params.environment).map(([k, v]) => `${k}=${v}`).join(',')
        args.push('--environment', `Variables={${vars}}`)
      }
      return [args]
    }

    case 'alb':
      return [['elbv2', 'add-tags', '--resource-arns', node.id, '--tags', `Key=Name,Value=${params.name}`]]

    case 'cloudfront':
      // CloudFront edits use SDK via IPC (CF_UPDATE), not CLI
      return []

    case 'apigw': {
      const p = params as ApigwEditParams
      const corsArgs = p.corsOrigins.length > 0
        ? ['--cors-configuration', `AllowOrigins=${p.corsOrigins.join(',')},AllowMethods=*,AllowHeaders=*`]
        : ['--cors-configuration', '{}']
      return [['apigatewayv2', 'update-api', '--api-id', p.apiId, '--name', p.name, ...corsArgs]]
    }

    case 'eventbridge-bus': {
      const args = ['events', 'update-event-bus', '--name', params.busName]
      args.push('--description', params.description)
      return [args]
    }

    case 'sqs':
      return [['sqs', 'set-queue-attributes', '--queue-url', params.queueUrl,
        '--attributes', `VisibilityTimeout=${params.visibilityTimeout},MessageRetentionPeriod=${params.messageRetentionPeriod}`]]

    case 'sns':
      return [['sns', 'set-topic-attributes', '--topic-arn', params.topicArn,
        '--attribute-name', 'DisplayName', '--attribute-value', params.displayName]]

    case 'ecr-repo':
      return [
        ['ecr', 'put-image-tag-mutability', '--repository-name', params.repositoryName,
          '--image-tag-mutability', params.imageTagMutability],
        ['ecr', 'put-image-scanning-configuration', '--repository-name', params.repositoryName,
          '--image-scanning-configuration', `scanOnPush=${params.scanOnPush}`],
      ]

    default:
      return []
  }
}
