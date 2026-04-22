import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const HALT_FILE_NAME = '.riftview-automation-halt'

export type HaltReason = {
  kind: 'file' | 'label'
  path?: string
  label?: 'automation:halt' | 'automation:halt-all'
}

export type HaltInput = {
  issueId: string
  workspaceDir: string
  linearLabels: readonly string[]
}

export type HaltResult = { halted: boolean; reason?: HaltReason }

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
