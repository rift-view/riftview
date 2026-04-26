import type { CloudNode, NodeStatus } from '@riftview/shared'

interface TfStateResource {
  type: string
  name: string
  module?: string
  instances: Array<{ attributes: Record<string, unknown> }> | null
}

interface TfState {
  version: number
  resources: TfStateResource[]
}

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'key_pair',
  'private_key',
  'sensitive_values'
]

function sanitizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([k]) => !SENSITIVE_KEYS.some((s) => k.includes(s)))
  )
}

function mapResource(type: string, name: string, attrs: Record<string, unknown>): CloudNode {
  const base = {
    status: 'imported' as NodeStatus,
    region: (attrs['region'] as string | undefined) ?? 'unknown',
    metadata: attrs
  }

  switch (type) {
    case 'aws_instance':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:ec2',
        label: (attrs['id'] as string) ?? name
      }
    case 'aws_vpc':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:vpc',
        label:
          (attrs['tags'] as Record<string, string> | undefined)?.['Name'] ?? (attrs['id'] as string)
      }
    case 'aws_subnet':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:subnet',
        label: attrs['id'] as string,
        parentId: attrs['vpc_id'] as string | undefined
      }
    case 'aws_security_group':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:security-group',
        label: (attrs['name'] as string) ?? name
      }
    case 'aws_s3_bucket':
      return { ...base, id: attrs['id'] as string, type: 'aws:s3', label: attrs['id'] as string }
    case 'aws_lambda_function':
      return {
        ...base,
        id: attrs['function_name'] as string,
        type: 'aws:lambda',
        label: attrs['function_name'] as string
      }
    case 'aws_db_instance':
      return { ...base, id: attrs['id'] as string, type: 'aws:rds', label: attrs['id'] as string }
    case 'aws_lb':
    case 'aws_alb':
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:alb',
        label: (attrs['name'] as string) ?? name
      }
    case 'aws_api_gateway_v2_api':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:apigw',
        label: (attrs['name'] as string) ?? name
      }
    case 'aws_cloudfront_distribution':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:cloudfront',
        label: (attrs['domain_name'] as string) ?? name
      }
    case 'aws_internet_gateway':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:igw',
        label:
          (attrs['tags'] as Record<string, string> | undefined)?.['Name'] ?? (attrs['id'] as string)
      }
    case 'aws_nat_gateway':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:nat-gateway',
        label:
          (attrs['tags'] as Record<string, string> | undefined)?.['Name'] ?? (attrs['id'] as string)
      }
    case 'aws_sqs_queue':
      // Scanner enriches node ID from queue URL to queue ARN
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:sqs',
        label:
          ((attrs['url'] as string | undefined) ?? (attrs['arn'] as string)).split('/').pop() ??
          (attrs['arn'] as string)
      }
    case 'aws_sns_topic':
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:sns',
        label: (attrs['arn'] as string).split(':').pop() ?? (attrs['arn'] as string)
      }
    case 'aws_dynamodb_table':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:dynamo',
        label: attrs['id'] as string
      }
    case 'aws_ssm_parameter':
      // Scanner uses ARN ?? Name as ID
      return {
        ...base,
        id: (attrs['arn'] as string | undefined) ?? (attrs['name'] as string),
        type: 'aws:ssm-param',
        label: attrs['name'] as string
      }
    case 'aws_secretsmanager_secret':
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:secret',
        label: (attrs['name'] as string | undefined) ?? (attrs['arn'] as string)
      }
    case 'aws_ecr_repository':
      // Scanner uses repositoryArn as ID
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:ecr-repo',
        label: (attrs['name'] as string | undefined) ?? (attrs['arn'] as string)
      }
    case 'aws_route53_zone':
      // Scanner uses item.Id (e.g. /hostedzone/Z1234) as ID; TF state 'id' matches this
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'aws:r53-zone',
        label: (attrs['name'] as string | undefined) ?? (attrs['id'] as string)
      }
    case 'aws_sfn_state_machine':
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:sfn',
        label: (attrs['name'] as string | undefined) ?? (attrs['arn'] as string)
      }
    case 'aws_cloudwatch_event_bus':
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:eventbridge-bus',
        label: (attrs['name'] as string | undefined) ?? (attrs['arn'] as string)
      }
    case 'aws_acm_certificate':
      return {
        ...base,
        id: attrs['arn'] as string,
        type: 'aws:acm',
        label: (attrs['domain_name'] as string | undefined) ?? (attrs['arn'] as string)
      }
    case 'aws_apigatewayv2_route':
      // Scanner ID is `${apiId}/routes/${routeId}`
      return {
        ...base,
        id: `${attrs['api_id'] as string}/routes/${attrs['id'] as string}`,
        type: 'aws:apigw-route',
        label: (attrs['route_key'] as string | undefined) ?? (attrs['id'] as string)
      }
    default:
      return {
        ...base,
        id: `tf-unknown-${type}-${name}`,
        type: 'unknown',
        label: `${type}.${name}`,
        metadata: { ...attrs, unsupportedTfType: type }
      }
  }
}

export function parseTfState(raw: string): CloudNode[] {
  let state: TfState
  try {
    state = JSON.parse(raw) as TfState
  } catch {
    throw new Error('Invalid tfstate file: not valid JSON')
  }
  if (!Array.isArray(state.resources)) {
    throw new Error('Invalid tfstate file: missing resources array')
  }
  return state.resources
    .filter((r) => r.type.startsWith('aws_'))
    .flatMap((r) =>
      (r.instances ?? []).map((instance) =>
        mapResource(r.type, r.name, sanitizeAttributes(instance.attributes ?? {}))
      )
    )
}

export interface TfModuleGroup {
  name: string
  resourceCount: number
  nodes: CloudNode[]
}

export function parseTfStateModules(raw: string): TfModuleGroup[] {
  let state: TfState
  try {
    state = JSON.parse(raw) as TfState
  } catch {
    throw new Error('Invalid tfstate file: not valid JSON')
  }
  if (!Array.isArray(state.resources)) {
    throw new Error('Invalid tfstate file: missing resources array')
  }

  const groups = new Map<string, { nodes: CloudNode[]; resourceCount: number }>()

  for (const r of state.resources) {
    if (!r.type.startsWith('aws_')) continue
    // module.vpc.aws_vpc.main → top-level segment is "vpc"; no module field → "(root)"
    const moduleName = r.module
      ? (r.module.replace(/^module\./, '').split('.')[0] ?? '(root)')
      : '(root)'

    let group = groups.get(moduleName)
    if (!group) {
      group = { nodes: [], resourceCount: 0 }
      groups.set(moduleName, group)
    }

    const instances = r.instances ?? []
    for (const instance of instances) {
      group.nodes.push(mapResource(r.type, r.name, sanitizeAttributes(instance.attributes ?? {})))
      group.resourceCount++
    }
  }

  return Array.from(groups.entries()).map(([name, g]) => ({
    name,
    resourceCount: g.resourceCount,
    nodes: g.nodes
  }))
}
