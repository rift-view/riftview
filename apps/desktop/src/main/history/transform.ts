import type { CloudNode, NodeType } from '@riftview/shared'

export interface SnapshotRecord {
  shape: Record<string, unknown>
  data: Record<string, unknown>
}

export const REDACTED = '[redacted]' as const

const SECRET_KEY_PATTERN = /password|secret|token|apikey|privatekey/i

const DATA_KEYS: Record<NodeType, readonly string[]> = {
  ec2: ['ebsSnapshotIds'],
  rds: ['latestSnapshotArn', 'pitrEarliestRestoreTime'],
  s3: ['versioningState', 'objectCountMarker'],
  lambda: ['codeSha256', 'codeSource'],
  sqs: ['inflightMessageCount'],
  sns: ['inflightMessageCount'],
  dynamo: ['pitrLatest', 'continuousBackupsStatus', 'onDemandBackupArn'],
  'ssm-param': ['value', 'versionNumber', 'lastModified'],
  'ecr-repo': ['imageDigests'],
  'r53-zone': ['records', 'recordSetCount'],
  sfn: ['recentExecutionCount'],
  ses: ['sendQuota', 'sendLast24h'],
  cognito: ['userCountMarker'],
  kinesis: ['iteratorAgeMs', 'incomingRecordsMarker'],
  elasticache: ['latestAutomaticSnapshotName'],
  opensearch: ['latestAutomaticSnapshotRef'],
  'eventbridge-bus': [],
  vpc: [],
  subnet: [],
  alb: [],
  'security-group': [],
  igw: [],
  acm: [],
  cloudfront: [],
  apigw: [],
  'apigw-route': [],
  secret: [],
  'nat-gateway': [],
  ecs: [],
  eks: [],
  msk: [],
  unknown: []
}

function redactKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactKeys)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      out[k] = REDACTED
    } else {
      out[k] = redactKeys(v)
    }
  }
  return out
}

function applyNodeTypeRules(
  type: NodeType,
  shape: Record<string, unknown>,
  data: Record<string, unknown>
): void {
  switch (type) {
    case 'secret':
      for (const bag of [shape, data]) {
        if ('SecretString' in bag) bag.SecretString = REDACTED
        if ('SecretBinary' in bag) bag.SecretBinary = REDACTED
      }
      break
    case 'ssm-param':
      if (shape.type === 'SecureString') {
        if ('value' in shape) shape.value = REDACTED
        if ('value' in data) data.value = REDACTED
      }
      break
    case 'lambda':
      if (shape.environment && typeof shape.environment === 'object') {
        const env = shape.environment as Record<string, unknown>
        if (env.variables && typeof env.variables === 'object' && !Array.isArray(env.variables)) {
          env.variables = Object.keys(env.variables as Record<string, unknown>)
        }
      }
      break
    case 'acm':
      if ('PrivateKey' in shape) shape.PrivateKey = REDACTED
      break
  }
}

export function toSnapshotRecord(node: CloudNode): SnapshotRecord {
  const metadata = node.metadata ?? {}
  const dataKeys = new Set(DATA_KEYS[node.type] ?? [])
  const shape: Record<string, unknown> = {}
  const data: Record<string, unknown> = {}

  for (const [k, v] of Object.entries(metadata)) {
    if (dataKeys.has(k)) data[k] = v
    else shape[k] = v
  }

  applyNodeTypeRules(node.type, shape, data)

  return {
    shape: redactKeys(shape) as Record<string, unknown>,
    data: redactKeys(data) as Record<string, unknown>
  }
}
