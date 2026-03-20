import type { CloudNode } from '../types/cloud'

export interface DeleteOptions {
  skipFinalSnapshot?: boolean
  force?: boolean
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
      const args = ['rds', 'delete-db-instance', '--db-instance-identifier', node.id]
      if (opts.skipFinalSnapshot) args.push('--skip-final-snapshot')
      return [args]
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
    default:
      // Intentionally partial: subnet, igw, cloudfront, sqs, secret, ecr-repo, sns,
      // dynamo, ssm-param, nat-gateway, r53-zone, sfn, eventbridge-bus do not yet have
      // delete commands wired up. Returning [] means the DeleteDialog will show no
      // preview command, which is the intended safe behaviour until each is implemented.
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
