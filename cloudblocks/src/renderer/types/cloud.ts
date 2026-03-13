export type NodeStatus = 'running' | 'stopped' | 'pending' | 'error' | 'unknown' | 'creating'

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

export interface CloudNode {
  id: string
  type: NodeType
  label: string
  status: NodeStatus
  region: string
  metadata: Record<string, unknown>
  parentId?: string
}

export interface CloudEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface ScanDelta {
  added: CloudNode[]
  changed: CloudNode[]
  removed: string[]
}

export interface AwsProfile {
  name: string
  region?: string
}

export interface Settings {
  deleteConfirmStyle: 'type-to-confirm' | 'command-drawer'
  scanInterval: 15 | 30 | 60 | 'manual'
}
