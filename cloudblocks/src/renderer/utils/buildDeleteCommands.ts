import type { CloudNode } from '../types/cloud'

export interface DeleteOptions {
  skipFinalSnapshot?: boolean
  force?: boolean
  disableProtectionFirst?: boolean
}

export function buildDeleteCommands(node: CloudNode, opts: DeleteOptions = {}): string[][] {
  switch (node.type) {
    case 'vpc':
      return [['ec2', 'delete-vpc', '--vpc-id', node.id]]
    case 'ec2':
      return [['ec2', 'terminate-instances', '--instance-ids', node.id]]
    case 'security-group':
      return [['ec2', 'delete-security-group', '--group-id', node.id]]
    case 'rds': {
      const cmds: string[][] = []
      if (opts.disableProtectionFirst) {
        cmds.push(['rds', 'modify-db-instance', '--db-instance-identifier', node.id, '--no-deletion-protection'])
      }
      const deleteArgs = ['rds', 'delete-db-instance', '--db-instance-identifier', node.id]
      if (opts.skipFinalSnapshot) deleteArgs.push('--skip-final-snapshot')
      cmds.push(deleteArgs)
      return cmds
    }
    case 's3': {
      const args = ['s3', 'rb', `s3://${node.id}`]
      if (opts.force) args.push('--force')
      return [args]
    }
    case 'lambda':
      return [['lambda', 'delete-function', '--function-name', node.id]]
    case 'alb':
      return [['elbv2', 'delete-load-balancer', '--load-balancer-arn', node.id]]
    case 'acm':
      return [['acm', 'delete-certificate', '--certificate-arn', node.id]]
    case 'apigw':
      return [['apigatewayv2', 'delete-api', '--api-id', node.id]]
    case 'apigw-route': {
      const meta = node.metadata as { apiId: string; routeId: string }
      return [['apigatewayv2', 'delete-route', '--api-id', meta.apiId, '--route-id', meta.routeId]]
    }
    case 'sqs':
      return [['sqs', 'delete-queue', '--queue-url', (node.metadata.url as string | undefined) ?? node.id]]
    case 'sns':
      return [['sns', 'delete-topic', '--topic-arn', node.id]]
    case 'dynamo':
      return [['dynamodb', 'delete-table', '--table-name', node.label]]
    case 'secret':
      return [['secretsmanager', 'delete-secret', '--secret-id', node.id]]
    case 'ecr-repo':
      return [['ecr', 'delete-repository', '--repository-name', node.label, '--force']]
    case 'sfn':
      return [['stepfunctions', 'delete-state-machine', '--state-machine-arn', node.id]]
    case 'eventbridge-bus':
      // The default event bus cannot be deleted
      if (node.label === 'default') return []
      return [['events', 'delete-event-bus', '--name', node.label]]
    case 'r53-zone':
      return [['route53', 'delete-hosted-zone', '--id', node.id]]
    case 'ssm-param':
      return [['ssm', 'delete-parameter', '--name', node.label]]
    case 'subnet':
      return [['ec2', 'delete-subnet', '--subnet-id', node.id]]
    case 'nat-gateway':
      return [['ec2', 'delete-nat-gateway', '--nat-gateway-id', node.id]]
    case 'igw': {
      const vpcId = node.parentId ?? (node.metadata.vpcId as string | undefined)
      if (vpcId) {
        return [
          ['ec2', 'detach-internet-gateway', '--internet-gateway-id', node.id, '--vpc-id', vpcId],
          ['ec2', 'delete-internet-gateway', '--internet-gateway-id', node.id],
        ]
      }
      return [['ec2', 'delete-internet-gateway', '--internet-gateway-id', node.id]]
    }
    default:
      // Intentionally partial: cloudfront does not yet have a delete command wired up.
      // Returning [] means the DeleteDialog will show no preview command,
      // which is the intended safe behaviour until each is implemented.
      return []
  }
}

export function buildQuickActionCommand(node: CloudNode, action: 'stop' | 'start' | 'reboot'): string[][] {
  if (node.type === 'ec2') {
    if (action === 'stop')   return [['ec2', 'stop-instances',   '--instance-ids', node.id]]
    if (action === 'start')  return [['ec2', 'start-instances',  '--instance-ids', node.id]]
    if (action === 'reboot') return [['ec2', 'reboot-instances', '--instance-ids', node.id]]
  }
  if (node.type === 'rds') {
    if (action === 'stop')   return [['rds', 'stop-db-instance',   '--db-instance-identifier', node.id]]
    if (action === 'start')  return [['rds', 'start-db-instance',  '--db-instance-identifier', node.id]]
    if (action === 'reboot') return [['rds', 'reboot-db-instance', '--db-instance-identifier', node.id]]
  }
  return []
}
