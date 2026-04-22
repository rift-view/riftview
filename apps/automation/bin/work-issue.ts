#!/usr/bin/env node
import {
  acquireLock,
  releaseLock,
  DEFAULT_LOCK_DIR,
  probe,
  resolveProfile,
  isHalted,
  auditLog,
  defaultLogPath
} from '@riftview/automation-core'
import { ghCliClient, gitCliClient } from '../src/clients'

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const issueId = args.find((a) => /^RIFT-\d+$/i.test(a))
  if (!issueId) {
    console.error('usage: work-issue RIFT-N [--preflight] [--profile=...]')
    process.exit(2)
  }
  const preflight = args.includes('--preflight')
  const profileName = args.find((a) => a.startsWith('--profile='))?.split('=')[1]
  const profile = resolveProfile(profileName)

  const ghUser = process.env.GH_USER ?? 'juliushamm'
  const log = defaultLogPath(issueId)

  const halt = isHalted({ issueId, workspaceDir: process.cwd(), linearLabels: [] })
  if (halt.halted) {
    console.log(`HALT reason=${halt.reason.kind}`)
    auditLog(log, { ts: new Date().toISOString(), phase: 'halted', status: 'error', data: halt })
    process.exit(3)
  }

  const lock = acquireLock({ issueId, dir: DEFAULT_LOCK_DIR })
  if (!lock.ok) {
    console.log(`HALT ${lock.reason}`)
    process.exit(3)
  }

  try {
    const gh = ghCliClient()
    const git = gitCliClient()
    const state = await probe({ issueId, ghUser, gh, git })
    console.log(JSON.stringify({ issueId, profile: profile.name, state }))
    auditLog(log, {
      ts: new Date().toISOString(),
      phase: 'triage',
      status: 'pending',
      data: state
    })

    if (preflight) return

    throw new Error('full pipeline not yet implemented (M9)')
    // Preflight releases immediately; full-pipeline mode keeps the lock
    // and delegates release to the --cleanup subcommand in M9.
  } finally {
    if (preflight) releaseLock({ issueId, dir: DEFAULT_LOCK_DIR })
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
