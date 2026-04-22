export type GhClient = {
  listPullRequests(query: string): Promise<PullRequestSummary[]>
  getPullRequestStatus(prNumber: number): Promise<{
    state: 'green' | 'red' | 'running' | 'none'
    mergeable: boolean
  }>
}

export type GitClient = {
  lsRemoteBranches(pattern: string): Promise<string[]>
  listCommitsAhead(branch: string, base: string): Promise<number>
}

export type PullRequestSummary = {
  number: number
  author: string
  isDraft: boolean
  headRefName: string
  title: string
}

export type ProbeState =
  | { state: 'fresh' }
  | { state: 'resume-branch'; branchName: string; commitsAhead: number }
  | {
      state: 'continue-pr'
      prNumber: number
      ciState: 'green' | 'red' | 'running' | 'none'
      mergeable: boolean
    }
  | { state: 'merge-ready'; prNumber: number }
  | { state: 'abort-not-ours'; prNumber: number; author: string }
  | { state: 'abort-ci-running'; prNumber: number }

export async function probe({
  issueId,
  ghUser,
  gh,
  git
}: {
  issueId: string
  ghUser: string
  gh: GhClient
  git: GitClient
}): Promise<ProbeState> {
  const prs = await gh.listPullRequests(`${issueId} in:title,body`)
  const nonDraftOpen = prs.filter((p) => !p.isDraft)

  if (nonDraftOpen.length > 0) {
    const mine = nonDraftOpen.find((p) => p.author === ghUser)
    const theirs = nonDraftOpen.find((p) => p.author !== ghUser)
    if (theirs && !mine)
      return { state: 'abort-not-ours', prNumber: theirs.number, author: theirs.author }

    if (mine) {
      const status = await gh.getPullRequestStatus(mine.number)
      if (status.state === 'running') return { state: 'abort-ci-running', prNumber: mine.number }
      if (status.state === 'green' && status.mergeable)
        return { state: 'merge-ready', prNumber: mine.number }
      return {
        state: 'continue-pr',
        prNumber: mine.number,
        ciState: status.state,
        mergeable: status.mergeable
      }
    }
  }

  const branches = await git.lsRemoteBranches(`*rift-${extractNum(issueId)}-*`)
  if (branches.length > 0) {
    const ahead = await git.listCommitsAhead(branches[0], 'main')
    if (ahead > 0) return { state: 'resume-branch', branchName: branches[0], commitsAhead: ahead }
  }
  return { state: 'fresh' }
}

function extractNum(issueId: string): string {
  const m = issueId.match(/RIFT-(\d+)/i)
  return m ? m[1] : ''
}
