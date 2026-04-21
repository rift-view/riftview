// Stable CLI output schema v1. CI consumers rely on these shapes — any
// additive change must bump SCHEMA_VERSION.
import type { Advisory, CloudNode, EdgeType, ScanError } from '@riftview/shared'

export const SCHEMA_VERSION = 1 as const

export type SchemaVersion = typeof SCHEMA_VERSION

/**
 * Flattened integration edge emitted in `ScanOutput.edges`. Derived from
 * each `CloudNode.integrations[]`. Kept platform-agnostic — consumers
 * should not assume React Flow semantics.
 */
export interface OutputIntegrationEdge {
  source: string
  target: string
  edgeType: EdgeType
}

export interface ScanOutput {
  schemaVersion: SchemaVersion
  command: 'scan'
  profile: string
  regions: string[]
  endpoint?: string
  timestamp: string
  durationMs: number
  nodes: CloudNode[]
  edges: OutputIntegrationEdge[]
  scanErrors: ScanError[]
  topRisks: Advisory[]
}

/**
 * Advisory decorated with a stable CI-safe id so downstream dedupe works
 * without re-synthesising `${ruleId}:${nodeId}` in shell pipelines.
 */
export interface Finding extends Advisory {
  id: string
}

export interface RisksOutput {
  schemaVersion: SchemaVersion
  command: 'risks'
  source: 'scan' | 'snapshot'
  snapshotPath?: string
  advisories: Finding[]
  counts: { critical: number; warning: number; info: number }
  failOn?: 'S1' | 'S2' | 'S3'
  exitCode: number
}

export interface DriftOutput {
  schemaVersion: SchemaVersion
  command: 'drift'
  statePath: string
  matched: string[]
  unmanaged: CloudNode[]
  missing: CloudNode[]
  counts: { matched: number; unmanaged: number; missing: number }
  exitCode: number
}

export interface DiffChange {
  id: string
  fields: Array<{ field: string; before: unknown; after: unknown }>
}

export interface DiffOutput {
  schemaVersion: SchemaVersion
  command: 'diff'
  a: string
  b: string
  added: CloudNode[]
  removed: CloudNode[]
  changed: DiffChange[]
}

export interface VersionOutput {
  schemaVersion: SchemaVersion
  command: 'version'
  version: string
  commit: string
  buildDate: string
  node: string
}
