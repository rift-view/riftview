import type { CloudNode } from '@riftview/shared'

export interface TfModuleInfo {
  name: string
  resourceCount: number
  nodes: CloudNode[]
}
