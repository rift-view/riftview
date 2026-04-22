#!/usr/bin/env node
import { resolveProfile, defaultLogPath } from '@riftview/automation-core'
import { preflight, pollDispatch, pollCi, mergeGate, cleanup } from '../src/commands'
import { ghCliClient, gitCliClient, linearApiClient } from '../src/clients'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const pExecFile = promisify(execFile)

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const issueId = args.find((a) => /^RIFT-\d+$/i.test(a))
  if (!issueId) {
    console.error(
      'usage: work-issue RIFT-N [--preflight | --poll-dispatch | --poll-ci <PR> | --merge-gate <PR> | --cleanup] [--profile=<name>]'
    )
    process.exit(2)
  }
  const profile = resolveProfile(args.find((a) => a.startsWith('--profile='))?.split('=')[1])
  const ghUser = process.env.GH_USER ?? 'juliushamm'
  const workspaceDir = process.cwd()
  const log = defaultLogPath(issueId)

  if (args.includes('--preflight')) {
    const r = await preflight(issueId, {
      gh: ghCliClient(),
      git: gitCliClient(),
      workspaceDir,
      ghUser,
      log
    })
    if (r.kind === 'halt') {
      console.log(`HALT ${r.reason}`)
      process.exit(3)
    }
    if (r.kind === 'lock-contention') {
      console.log(`HALT ${r.reason}`)
      process.exit(3)
    }
    console.log(JSON.stringify({ issueId, profile: profile.name, state: r.state }))
    return
  }

  if (args.includes('--poll-dispatch')) {
    const r = await pollDispatch(issueId, { linear: linearApiClient(), workspaceDir, log })
    if (r.kind === 'dispatch-ok') {
      console.log('dispatch-ok')
      return
    }
    if (r.kind === 'halt') {
      console.log(`HALT ${r.reason}`)
      process.exit(3)
    }
    console.log('TIMEOUT')
    process.exit(3)
  }

  const pollCiFlagIndex = args.indexOf('--poll-ci')
  if (pollCiFlagIndex !== -1) {
    const prNumber = parseInt(args[pollCiFlagIndex + 1] ?? '', 10)
    if (!prNumber) {
      console.error('--poll-ci <PR-NUMBER> required')
      process.exit(2)
    }
    const linear = linearApiClient()
    const r = await pollCi(prNumber, {
      gh: ghCliClient(),
      workspaceDir,
      issueId,
      linearLabelsOf: () => linear.listLabels(issueId)
    })
    if (r.kind === 'green') {
      console.log(JSON.stringify({ kind: 'green', mergeable: r.mergeable }))
      return
    }
    if (r.kind === 'red') {
      console.log('red')
      process.exit(4)
    }
    if (r.kind === 'halt') {
      console.log(`HALT ${r.reason}`)
      process.exit(3)
    }
    console.log('TIMEOUT')
    process.exit(3)
  }

  const mergeGateIndex = args.indexOf('--merge-gate')
  if (mergeGateIndex !== -1) {
    const prNumber = parseInt(args[mergeGateIndex + 1] ?? '', 10)
    if (!prNumber) {
      console.error('--merge-gate <PR-NUMBER> required')
      process.exit(2)
    }
    const linear = linearApiClient()
    const r = await mergeGate(prNumber, issueId, {
      linear,
      workspaceDir,
      isAlreadyMerged: async () => {
        const { stdout } = await pExecFile('gh', [
          'pr',
          'view',
          String(prNumber),
          '--json',
          'state'
        ])
        return (JSON.parse(stdout) as { state: string }).state === 'MERGED'
      },
      performMerge: async () => {
        await pExecFile('gh', ['pr', 'merge', String(prNumber), '--squash', '--delete-branch'])
      },
      markLinearDone: async () => {
        // For v1: post a comment; the human closes the Linear issue manually via label automation.
        await linear.postComment(
          issueId,
          '🟢 automation:done — PR merged, Linear state flip TBD (M9 v1)'
        )
      }
    })
    if (r.kind === 'merged-by-bot' || r.kind === 'merged-by-human') {
      console.log(r.kind)
      return
    }
    if (r.kind === 'halt') {
      console.log(`HALT ${r.reason}`)
      process.exit(3)
    }
    console.log('TIMEOUT')
    process.exit(3)
  }

  if (args.includes('--cleanup')) {
    await cleanup(issueId, { linear: linearApiClient(), log })
    console.log('cleanup-done')
    return
  }

  console.error(
    'no subcommand specified; expected --preflight | --poll-dispatch | --poll-ci <PR> | --merge-gate <PR> | --cleanup'
  )
  process.exit(2)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
