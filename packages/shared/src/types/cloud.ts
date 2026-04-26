export type NodeStatus =
  | 'running'
  | 'stopped'
  | 'pending'
  | 'error'
  | 'unknown'
  | 'creating'
  | 'deleting'
  | 'imported'

export type DriftStatus = 'unmanaged' | 'missing' | 'matched'

/**
 * Canonical list of all NodeType union members.
 *
 * Format: every namespaced member matches `^[a-z]+:[a-z0-9-]+$` (provider
 * prefix + colon + resource kind). The lone exception is the `'unknown'`
 * sentinel, which stays un-namespaced because it is shared across providers
 * for unmapped scan results.
 *
 * Why a `const` array (not just a union):
 *   - TypeScript types vanish at runtime; tests need a concrete handle on
 *     the union members to assert e.g. naming-convention compliance
 *     (see `__tests__/node-type-namespace.test.ts`).
 *   - Future contract tests (RIFT-81) iterate this array to verify every
 *     plugin's `nodeTypes` array agrees with what the renderer renders.
 */
export const NODE_TYPES = [
  'aws:ec2',
  'aws:vpc',
  'aws:subnet',
  'aws:rds',
  'aws:s3',
  'aws:lambda',
  'aws:alb',
  'aws:security-group',
  'aws:igw',
  'aws:acm',
  'aws:cloudfront',
  'aws:apigw',
  'aws:apigw-route',
  'aws:sqs',
  'aws:secret',
  'aws:ecr-repo',
  'aws:sns',
  'aws:dynamo',
  'aws:ssm-param',
  'aws:nat-gateway',
  'aws:r53-zone',
  'aws:sfn',
  'aws:eventbridge-bus',
  'aws:ses',
  'aws:cognito',
  'aws:kinesis',
  'aws:ecs',
  'aws:elasticache',
  'aws:eks',
  'aws:opensearch',
  'aws:msk',
  'unknown'
] as const

export type NodeType = (typeof NODE_TYPES)[number]

export type EdgeType = 'trigger' | 'origin' | 'subscription'

export interface IntegrationEdgeData extends Record<string, unknown> {
  isIntegration: true
  edgeType: EdgeType
}

export interface CloudNode {
  id: string
  type: NodeType
  label: string
  status: NodeStatus
  region: string
  metadata: Record<string, unknown>
  parentId?: string
  integrations?: { targetId: string; edgeType: EdgeType }[]
  driftStatus?: DriftStatus
  tfMetadata?: Record<string, unknown>
}

export interface CloudEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface ScanError {
  service: string
  region: string
  message: string
}

export interface ScanDelta {
  added: CloudNode[]
  changed: CloudNode[]
  removed: string[]
  scanErrors?: ScanError[]
}

export interface AwsProfile {
  name: string
  region?: string
  endpoint?: string
}

export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  showRegionIndicators: boolean
  regionColors: Record<string, string>
  showScanErrorBadges: boolean
  notifyOnDrift: boolean
}

export type CustomEdgeColor = '#f59e0b' | '#14b8a6' | '#6366f1' | '#22c55e' | '#ef4444' | '#8b5cf6'

export interface CustomEdge {
  id: string
  source: string
  target: string
  color: CustomEdgeColor
  label?: string
}

// ── IAM analysis types ────────────────────────────────────────────────────────

export type IamSeverity = 'critical' | 'warning' | 'info'

export interface IamFinding {
  severity: IamSeverity
  title: string
  detail: string
  policyName?: string
  statement?: string
}

export interface IamAnalysisResult {
  nodeId: string
  findings: IamFinding[]
  error?: string
  fetchedAt: number
}

// ── Advisory system (Phase 3: OP_INTELLIGENCE) ────────────────────────────────

export type AdvisoryRuleId =
  | 'ec2-public-ssh'
  | 'lambda-no-timeout'
  | 'lambda-low-memory'
  | 'lambda-no-dlq'
  | 's3-public-access'
  | 's3-no-versioning'
  | 'rds-no-multiaz'
  | 'rds-no-deletion-protection'
  | 'rds-no-backup'
  | 'sqs-no-dlq'
  | 'ecs-task-count-mismatch'
  | 'elasticache-no-replica'
  | 'opensearch-no-vpc'
  | 'apigw-lambda-rds-no-guardrails'
  | 'apigw-lambda-no-concurrency-limit'
  | 'lambda-sqs-no-dlq'
  | 'sns-sqs-lambda-no-dlq'

export type AdvisorySeverity = 'info' | 'warning' | 'critical'

export interface Advisory {
  ruleId: AdvisoryRuleId
  severity: AdvisorySeverity
  title: string
  detail: string
  nodeId: string
}
