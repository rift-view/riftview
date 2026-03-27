// src/main/plugin/types.ts
import type { CloudNode } from '../../renderer/types/cloud'

export interface ScanContext<TCredentials = unknown> {
  credentials: TCredentials
  region: string
}

export interface PluginScanResult {
  nodes: CloudNode[]
  errors: Array<{ service: string; region: string; message: string }>
}

export interface NodeTypeMetadata {
  /** Short all-caps badge shown inside the canvas node card. e.g. "AKS", "GCE" */
  label: string
  /** Border/accent hex color on the canvas node card. e.g. "#0078D4" */
  borderColor: string
  /** Badge background color in SearchPalette. Usually matches borderColor. */
  badgeColor: string
  /** Short abbreviation for SearchPalette chips. e.g. "AKS" */
  shortLabel: string
  /** Human-readable display name for Sidebar list. e.g. "Azure Kubernetes Service" */
  displayName: string
  /** Whether this type appears as a draggable item in the Sidebar create list. */
  hasCreate: boolean
}

export interface PluginCommandHandlers {
  buildCreate?: (resource: string, params: Record<string, unknown>) => string[][]
  buildDelete?: (node: CloudNode, opts?: Record<string, unknown>) => string[][]
  buildEdit?:   (node: CloudNode, params: Record<string, unknown>) => string[][]
}

export type PluginHclGenerator = (node: CloudNode) => string

export interface CloudblocksPlugin {
  readonly id: string
  readonly displayName: string
  readonly nodeTypes: readonly string[]
  readonly nodeTypeMetadata: Readonly<Record<string, NodeTypeMetadata>>
  createCredentials(profile: string, region: string, endpoint?: string): unknown
  scan(context: ScanContext): Promise<PluginScanResult>
  scanExtras?(region: string): Promise<void>
  commands?: PluginCommandHandlers
  hclGenerators?: Record<string, PluginHclGenerator>
  activate?(): void | Promise<void>
  deactivate?(): void | Promise<void>
  registerIpcHandlers?(win: Electron.BrowserWindow): void
}
