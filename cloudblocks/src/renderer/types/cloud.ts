export type NodeStatus = 'running' | 'stopped' | 'pending' | 'error' | 'unknown' | 'creating' | 'deleting' | 'imported'

export type DriftStatus = 'unmanaged' | 'missing' | 'matched'

export type NodeType =
  | 'ec2'
  | 'vpc'
  | 'subnet'
  | 'rds'
  | 's3'
  | 'lambda'
  | 'alb'
  | 'security-group'
  | 'igw'
  | 'acm'
  | 'cloudfront'
  | 'apigw'
  | 'apigw-route'
  | 'sqs'
  | 'secret'
  | 'ecr-repo'
  | 'sns'
  | 'dynamo'
  | 'ssm-param'
  | 'nat-gateway'
  | 'r53-zone'
  | 'sfn'
  | 'eventbridge-bus'
  | 'unknown'

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

export type Theme = 'dark' | 'light' | 'solarized' | 'rose-pine' | 'catppuccin' | 'solarized-light' | 'github-light' | 'nord-light'

export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  theme: Theme
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
