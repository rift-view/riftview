import {
  MERGE_REVIEW_TIMEOUT_MS,
  CI_POLL_INTERVAL_MS,
  isHalted,
  type LinearClient
} from '@riftview/automation-core'

export type MergeGateDeps = {
  linear: LinearClient
  workspaceDir: string
  isAlreadyMerged: () => Promise<boolean>
  performMerge: () => Promise<void>
  markLinearDone: () => Promise<void>
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export type MergeGateResult =
  | { kind: 'merged-by-bot' }
  | { kind: 'merged-by-human' }
  | { kind: 'halt'; reason: string }
  | { kind: 'timeout' }

export async function mergeGate(
  prNumber: number,
  issueId: string,
  deps: MergeGateDeps
): Promise<MergeGateResult> {
  const now = deps.now ?? (() => Date.now())
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const started = now()
  while (true) {
    if (await deps.isAlreadyMerged()) {
      await deps.markLinearDone()
      return { kind: 'merged-by-human' }
    }
    const labels = await deps.linear.listLabels(issueId)
    if (labels.includes('automation:merge-ok')) {
      await deps.performMerge()
      await deps.markLinearDone()
      return { kind: 'merged-by-bot' }
    }
    const halt = isHalted({ issueId, workspaceDir: deps.workspaceDir, linearLabels: labels })
    if (halt.halted) {
      return {
        kind: 'halt',
        reason: `${halt.reason.kind}:${halt.reason.kind === 'label' ? halt.reason.label : halt.reason.path}`
      }
    }
    if (now() - started > MERGE_REVIEW_TIMEOUT_MS) return { kind: 'timeout' }
    await sleep(CI_POLL_INTERVAL_MS)
  }
}
