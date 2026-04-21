// Help text snapshots — UX regression guard. Any change in flag names,
// descriptions, defaults, or argument syntax flips the snapshot and forces a
// reviewer to acknowledge it in the PR diff.
//
// To accept an intentional change:
//   npm test --workspace=@riftview/cli -- -u
//
// Snapshots are written to __snapshots__/help.snapshot.test.ts.snap colocated
// with this file. They are colour-free — commander's help printer doesn't emit
// ANSI codes by default, and we route through configureOutput so nothing
// else injects colour either.
import { describe, it, expect } from 'vitest'
import type { ScanRunner } from '../../cli/commands/scan'
import { buildProgram } from '../../cli/index'

// Stub runner so buildProgram doesn't fall back to awsScanRunner (which would
// try to load desktop plugin code from disk). Help text is orthogonal to deps.
const noopRunner: ScanRunner = async () => ({ nodes: [], errors: [], durationMs: 0 })

// Render help for a given command path (empty array = root program).
// Uses commander's helpInformation() instead of `--help`, which avoids the
// process.exit() call that `--help` triggers on subcommands even under
// exitOverride() (same bypass we work around in scan/risks/drift actions).
function renderHelp(commandPath: string[]): string {
  const program = buildProgram({
    scan: { runner: noopRunner, resolveDefaultRegion: () => 'us-east-1' },
    risks: { runner: noopRunner, resolveDefaultRegion: () => 'us-east-1' },
    drift: { runner: noopRunner, resolveDefaultRegion: () => 'us-east-1' }
  })
  let target = program
  for (const name of commandPath) {
    const sub = program.commands.find((c) => c.name() === name)
    if (!sub) throw new Error(`unknown subcommand for help snapshot: ${name}`)
    target = sub
  }
  return target.helpInformation()
}

describe('help text snapshots', () => {
  it('root --help', () => {
    expect(renderHelp([])).toMatchSnapshot()
  })

  it('scan --help', () => {
    expect(renderHelp(['scan'])).toMatchSnapshot()
  })

  it('risks --help', () => {
    expect(renderHelp(['risks'])).toMatchSnapshot()
  })

  it('drift --help', () => {
    expect(renderHelp(['drift'])).toMatchSnapshot()
  })

  it('diff --help', () => {
    expect(renderHelp(['diff'])).toMatchSnapshot()
  })

  it('version --help', () => {
    expect(renderHelp(['version'])).toMatchSnapshot()
  })
})
