import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preflight, pollDispatch, pollCi, mergeGate, cleanup } from '../src/commands'
import {
  HALT_FILE_NAME,
  type LinearClient,
  type GhClient,
  type GitClient
} from '@riftview/automation-core'

function mockLinear(
  initial: {
    labels?: string[]
    comments?: Array<{ id: string; body: string; createdAt: string }>
  } = {}
): LinearClient & {
  _labels: Set<string>
  _comments: Array<{ id: string; body: string; createdAt: string }>
} {
  const labels = new Set(initial.labels ?? [])
  const comments = [...(initial.comments ?? [])]
  return {
    _labels: labels,
    _comments: comments,
    async listLabels() {
      return [...labels]
    },
    async addLabel(_id, l) {
      labels.add(l)
    },
    async removeLabel(_id, l) {
      labels.delete(l)
    },
    async postComment(_id, body) {
      comments.push({ id: String(comments.length), body, createdAt: new Date().toISOString() })
    },
    async listComments() {
      return [...comments]
    }
  }
}

function mockGh(over: Partial<GhClient> = {}): GhClient {
  return {
    async listPullRequests() {
      return []
    },
    async getPullRequestStatus() {
      return { state: 'none', mergeable: false }
    },
    ...over
  }
}

function mockGit(over: Partial<GitClient> = {}): GitClient {
  return {
    async lsRemoteBranches() {
      return []
    },
    async listCommitsAhead() {
      return 0
    },
    ...over
  }
}

describe('preflight (refactored)', () => {
  let workspaceDir: string
  let lockDir: string
  let logDir: string
  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'rv-pre-'))
    lockDir = mkdtempSync(join(tmpdir(), 'rv-pre-lock-'))
    logDir = mkdtempSync(join(tmpdir(), 'rv-pre-log-'))
  })
  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
    rmSync(lockDir, { recursive: true, force: true })
    rmSync(logDir, { recursive: true, force: true })
  })

  it('returns ok with probe state on fresh issue', async () => {
    const r = await preflight('RIFT-1', {
      gh: mockGh(),
      git: mockGit(),
      workspaceDir,
      ghUser: 'juliushamm',
      log: join(logDir, 'r.log'),
      lockDir
    })
    expect(r.kind).toBe('ok')
    if (r.kind !== 'ok') throw new Error('expected ok')
    expect(r.state.state).toBe('fresh')
  })

  it('halts when workspace halt file present', async () => {
    writeFileSync(join(workspaceDir, HALT_FILE_NAME), '')
    const r = await preflight('RIFT-1', {
      gh: mockGh(),
      git: mockGit(),
      workspaceDir,
      ghUser: 'juliushamm',
      log: join(logDir, 'r.log'),
      lockDir
    })
    expect(r.kind).toBe('halt')
  })

  it('releases lock on success (re-acquirable)', async () => {
    const deps = {
      gh: mockGh(),
      git: mockGit(),
      workspaceDir,
      ghUser: 'juliushamm',
      log: join(logDir, 'r.log'),
      lockDir
    }
    await preflight('RIFT-1', deps)
    const r2 = await preflight('RIFT-1', deps) // would fail if the first didn't release
    expect(r2.kind).toBe('ok')
  })
})

describe('pollDispatch', () => {
  let workspaceDir: string
  let logDir: string
  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'rv-pd-'))
    logDir = mkdtempSync(join(tmpdir(), 'rv-pd-log-'))
  })
  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
    rmSync(logDir, { recursive: true, force: true })
  })

  it('returns dispatch-ok when label appears', async () => {
    const linear = mockLinear({ labels: ['automation:dispatch-ok'] })
    const r = await pollDispatch('RIFT-1', {
      linear,
      workspaceDir,
      log: join(logDir, 'r.log'),
      sleep: async () => {}
    })
    expect(r.kind).toBe('dispatch-ok')
  })

  it('returns halt when label appears', async () => {
    const linear = mockLinear({ labels: ['automation:halt'] })
    const r = await pollDispatch('RIFT-1', {
      linear,
      workspaceDir,
      log: join(logDir, 'r.log'),
      sleep: async () => {}
    })
    expect(r.kind).toBe('halt')
  })

  it('returns timeout when clock advances past DISPATCH_REVIEW_TIMEOUT_MS', async () => {
    const linear = mockLinear()
    let t = 0
    const r = await pollDispatch('RIFT-1', {
      linear,
      workspaceDir,
      log: join(logDir, 'r.log'),
      now: () => {
        const cur = t
        t += 25 * 3600 * 1000 // each tick > 24h
        return cur
      },
      sleep: async () => {}
    })
    expect(r.kind).toBe('timeout')
  })
})

describe('pollCi', () => {
  let workspaceDir: string
  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'rv-pci-'))
  })
  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('returns green when CI is green', async () => {
    const gh = mockGh({
      async getPullRequestStatus() {
        return { state: 'green', mergeable: true }
      }
    })
    const r = await pollCi(42, {
      gh,
      workspaceDir,
      issueId: 'RIFT-1',
      linearLabelsOf: async () => [],
      sleep: async () => {}
    })
    if (r.kind !== 'green') throw new Error(`expected green, got ${r.kind}`)
    expect(r.mergeable).toBe(true)
  })

  it('returns red when CI is red', async () => {
    const gh = mockGh({
      async getPullRequestStatus() {
        return { state: 'red', mergeable: false }
      }
    })
    const r = await pollCi(42, {
      gh,
      workspaceDir,
      issueId: 'RIFT-1',
      linearLabelsOf: async () => [],
      sleep: async () => {}
    })
    expect(r.kind).toBe('red')
  })

  it('returns halt when halt label appears mid-poll', async () => {
    let calls = 0
    const gh = mockGh({
      async getPullRequestStatus() {
        calls++
        return { state: 'running', mergeable: false }
      }
    })
    const labels = async (): Promise<string[]> => (calls >= 1 ? ['automation:halt'] : [])
    const r = await pollCi(42, {
      gh,
      workspaceDir,
      issueId: 'RIFT-1',
      linearLabelsOf: labels,
      sleep: async () => {}
    })
    expect(r.kind).toBe('halt')
  })
})

describe('mergeGate', () => {
  let workspaceDir: string
  beforeEach(() => {
    workspaceDir = mkdtempSync(join(tmpdir(), 'rv-mg-'))
  })
  afterEach(() => {
    rmSync(workspaceDir, { recursive: true, force: true })
  })

  it('returns merged-by-human when PR is already merged', async () => {
    const linear = mockLinear()
    let markedDone = false
    const r = await mergeGate(42, 'RIFT-1', {
      linear,
      workspaceDir,
      isAlreadyMerged: async () => true,
      performMerge: async () => {
        throw new Error('should not merge')
      },
      markLinearDone: async () => {
        markedDone = true
      },
      sleep: async () => {}
    })
    expect(r.kind).toBe('merged-by-human')
    expect(markedDone).toBe(true)
  })

  it('returns merged-by-bot after label + performMerge', async () => {
    const linear = mockLinear({ labels: ['automation:merge-ok'] })
    let merged = false
    const r = await mergeGate(42, 'RIFT-1', {
      linear,
      workspaceDir,
      isAlreadyMerged: async () => false,
      performMerge: async () => {
        merged = true
      },
      markLinearDone: async () => {},
      sleep: async () => {}
    })
    expect(r.kind).toBe('merged-by-bot')
    expect(merged).toBe(true)
  })

  it('returns halt when halt label appears before merge-ok', async () => {
    const linear = mockLinear({ labels: ['automation:halt'] })
    const r = await mergeGate(42, 'RIFT-1', {
      linear,
      workspaceDir,
      isAlreadyMerged: async () => false,
      performMerge: async () => {
        throw new Error('unreachable')
      },
      markLinearDone: async () => {
        throw new Error('unreachable')
      },
      sleep: async () => {}
    })
    expect(r.kind).toBe('halt')
  })
})

describe('cleanup', () => {
  let lockDir: string
  let logDir: string
  beforeEach(() => {
    lockDir = mkdtempSync(join(tmpdir(), 'rv-cl-'))
    logDir = mkdtempSync(join(tmpdir(), 'rv-cl-log-'))
  })
  afterEach(() => {
    rmSync(lockDir, { recursive: true, force: true })
    rmSync(logDir, { recursive: true, force: true })
  })

  it('releases lock + in-flight label + writes done log', async () => {
    const { acquireLock } = await import('@riftview/automation-core')
    acquireLock({ issueId: 'RIFT-1', dir: lockDir })
    const linear = mockLinear({ labels: ['automation:in-flight'] })
    await cleanup('RIFT-1', { linear, lockDir, log: join(logDir, 'r.log') })
    expect(linear._labels.has('automation:in-flight')).toBe(false)
    // lock file gone → re-acquire succeeds
    const r = acquireLock({ issueId: 'RIFT-1', dir: lockDir })
    expect(r.ok).toBe(true)
  })

  it('idempotent when no lock or label exists', async () => {
    const linear = mockLinear()
    await expect(
      cleanup('RIFT-1', { linear, lockDir, log: join(logDir, 'r.log') })
    ).resolves.toBeUndefined()
  })
})
