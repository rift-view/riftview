import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  probe,
  isHalted,
  HALT_FILE_NAME,
  acquireLock,
  releaseLock,
  resolveProfile,
  type GhClient,
  type GitClient
} from '@riftview/automation-core'

// Integration test for M8: the CLI glues probe + isHalted + acquireLock + profile + audit.
// Verify each glue point returns consistent JSON-shaped state the CLI prints.

function stubGh(): GhClient {
  return {
    async listPullRequests() {
      return []
    },
    async getPullRequestStatus() {
      return { state: 'none', mergeable: false }
    }
  }
}
function stubGit(): GitClient {
  return {
    async lsRemoteBranches() {
      return []
    },
    async listCommitsAhead() {
      return 0
    }
  }
}

describe('work-issue --preflight integration', () => {
  let workspaceDir: string
  let lockDir: string

  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'rv-pf-'))
    lockDir = mkdtempSync(join(tmpdir(), 'rv-pf-lock-'))
  })
  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
    rmSync(lockDir, { recursive: true, force: true })
  })

  it('halt file is detected before any probe runs', () => {
    writeFileSync(join(workspaceDir, HALT_FILE_NAME), '')
    const halt = isHalted({ issueId: 'RIFT-1', workspaceDir, linearLabels: [] })
    expect(halt.halted).toBe(true)
  })

  it('lock is acquired then released cleanly on fresh issue', async () => {
    const lock1 = acquireLock({ issueId: 'RIFT-1', dir: lockDir })
    expect(lock1.ok).toBe(true)
    const lock2 = acquireLock({ issueId: 'RIFT-1', dir: lockDir })
    expect(lock2.ok).toBe(false)
    releaseLock({ issueId: 'RIFT-1', dir: lockDir })
    const lock3 = acquireLock({ issueId: 'RIFT-1', dir: lockDir })
    expect(lock3.ok).toBe(true)
  })

  it('probe returns fresh when stub gh and git are empty', async () => {
    const state = await probe({
      issueId: 'RIFT-1',
      ghUser: 'juliushamm',
      gh: stubGh(),
      git: stubGit()
    })
    expect(state.state).toBe('fresh')
  })

  it('profile defaults to balanced+paranoid-step-3', () => {
    const p = resolveProfile()
    expect(p.name).toBe('balanced+paranoid-step-3')
    expect(p.dispatchReviewGate).toBe(true)
    expect(p.mergeGate).toBe(true)
  })

  it('profile --profile=aggressive parses correctly', () => {
    const p = resolveProfile('aggressive')
    expect(p.name).toBe('aggressive')
    expect(p.dispatchReviewGate).toBe(false)
    expect(p.mergeGate).toBe(false)
  })
})
