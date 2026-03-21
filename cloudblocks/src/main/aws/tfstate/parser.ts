import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

interface TfStateResource {
  type: string
  name: string
  instances: Array<{ attributes: Record<string, unknown> }> | null
}

interface TfState {
  version: number
  resources: TfStateResource[]
}

const SENSITIVE_KEYS = ['password', 'secret', 'token', 'key_pair', 'private_key', 'sensitive_values']

function sanitizeAttributes(attrs: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([k]) => !SENSITIVE_KEYS.some((s) => k.includes(s)))
  )
}

function mapResource(type: string, name: string, attrs: Record<string, unknown>): CloudNode {
  const base = {
    status: 'imported' as NodeStatus,
    region: (attrs['region'] as string | undefined) ?? 'unknown',
    metadata: attrs,
  }

  switch (type) {
    case 'aws_instance':
      return { ...base, id: attrs['id'] as string, type: 'ec2', label: (attrs['id'] as string) ?? name }
    case 'aws_vpc':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'vpc',
        label: ((attrs['tags'] as Record<string, string> | undefined)?.['Name']) ?? (attrs['id'] as string),
      }
    case 'aws_subnet':
      return {
        ...base,
        id: attrs['id'] as string,
        type: 'subnet',
        label: attrs['id'] as string,
        parentId: attrs['vpc_id'] as string | undefined,
      }
    case 'aws_security_group':
      return { ...base, id: attrs['id'] as string, type: 'security-group', label: (attrs['name'] as string) ?? name }
    case 'aws_s3_bucket':
      return { ...base, id: attrs['id'] as string, type: 's3', label: attrs['id'] as string }
    case 'aws_lambda_function':
      return { ...base, id: attrs['function_name'] as string, type: 'lambda', label: attrs['function_name'] as string }
    case 'aws_db_instance':
      return { ...base, id: attrs['id'] as string, type: 'rds', label: attrs['id'] as string }
    case 'aws_lb':
    case 'aws_alb':
      return { ...base, id: attrs['arn'] as string, type: 'alb', label: (attrs['name'] as string) ?? name }
    case 'aws_api_gateway_v2_api':
      return { ...base, id: attrs['id'] as string, type: 'apigw', label: (attrs['name'] as string) ?? name }
    case 'aws_cloudfront_distribution':
      return { ...base, id: attrs['id'] as string, type: 'cloudfront', label: (attrs['domain_name'] as string) ?? name }
    default:
      return {
        ...base,
        id: `tf-unknown-${type}-${name}`,
        type: 'unknown',
        label: `${type}.${name}`,
        metadata: { ...attrs, unsupportedTfType: type },
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
