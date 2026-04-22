import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const HALT_FILE_NAME = '.riftview-automation-halt'

export type HaltReason =
  | { kind: 'file'; path: string }
  | { kind: 'label'; label: 'automation:halt' | 'automation:halt-all' }

export type HaltInput = {
  /**
   * The issue being evaluated. Not used directly: callers are responsible for
   * passing `linearLabels` scoped to this issue plus any aggregated global
   * `automation:halt-all` labels. Retained so future per-issue scoping logic
   * can land without a signature change.
   */
  issueId: string
  workspaceDir: string
  linearLabels: readonly string[]
}

export type HaltResult = { halted: false } | { halted: true; reason: HaltReason }

export function isHalted({ workspaceDir, linearLabels }: HaltInput): HaltResult {
  const filePath = join(workspaceDir, HALT_FILE_NAME)
  if (existsSync(filePath)) {
    return { halted: true, reason: { kind: 'file', path: filePath } }
  }
  for (const label of ['automation:halt-all', 'automation:halt'] as const) {
    if (linearLabels.includes(label)) {
      return { halted: true, reason: { kind: 'label', label } }
    }
  }
  return { halted: false }
}
