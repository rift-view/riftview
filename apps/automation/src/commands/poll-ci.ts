import { CI_POLL_INTERVAL_MS, isHalted, type GhClient } from '@riftview/automation-core'

export type PollCiDeps = {
  gh: GhClient
  workspaceDir: string
  linearLabelsOf: () => Promise<string[]>
  issueId: string
  sleep?: (ms: number) => Promise<void>
}

export type PollCiResult =
  | { kind: 'green'; mergeable: boolean }
  | { kind: 'red' }
  | { kind: 'halt'; reason: string }

export async function pollCi(prNumber: number, deps: PollCiDeps): Promise<PollCiResult> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  while (true) {
    const status = await deps.gh.getPullRequestStatus(prNumber)
    if (status.state === 'green') return { kind: 'green', mergeable: status.mergeable }
    if (status.state === 'red') return { kind: 'red' }
    const labels = await deps.linearLabelsOf()
    const halt = isHalted({
      issueId: deps.issueId,
      workspaceDir: deps.workspaceDir,
      linearLabels: labels
    })
    if (halt.halted) {
      return {
        kind: 'halt',
        reason: `${halt.reason.kind}:${halt.reason.kind === 'label' ? halt.reason.label : halt.reason.path}`
      }
    }
    await sleep(CI_POLL_INTERVAL_MS)
  }
}
