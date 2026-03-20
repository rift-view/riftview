export type NodeStatus = 'running' | 'stopped' | 'pending' | 'error' | 'unknown' | 'creating' | 'deleting'

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

export type EdgeType = 'trigger' | 'origin' | 'subscription'

export interface IntegrationEdgeData {
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

export type Theme = 'dark' | 'light' | 'solarized' | 'rose-pine' | 'catppuccin'

export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
  theme: Theme
}
