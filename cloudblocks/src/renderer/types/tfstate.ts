import type { CloudNode } from './cloud'

export interface TfModuleInfo {
  name: string
  resourceCount: number
  nodes: CloudNode[]
}
