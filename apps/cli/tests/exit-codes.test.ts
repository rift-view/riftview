// Exit-code matrix regression guard. Each EXIT value (0–4) has a
// minimum-repro invocation that a CI consumer could rely on. Collapsing
// any two into the same code (or returning RUNTIME for a categorised
// failure) fails here.
//
// Reference table (also documented in docs/cli.md when that lands):
//   EXIT.OK       (0) — successful run
//   EXIT.FINDINGS (1) — --fail-on / --fail-on-drift gate tripped
//   EXIT.USAGE    (2) — bad flags / missing args / unreadable input
//   EXIT.AUTH     (3) — AWS credential failure (expired/invalid/permission)
//   EXIT.RUNTIME  (4) — unexpected error not covered by above
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { CloudNode } from '@riftview/shared'
import { buildProgram } from '../cli/index'
import { EXIT } from '../cli/exitCodes'
import { mapCommanderExit } from '../cli/exit-mapper'
import type { ScanRunner } from '../cli/commands/scan'

function run(
  argv: string[],
  runner: ScanRunner = async () => ({ nodes: [], errors: [], durationMs: 1 })
): Promise<{ caught: unknown; exitCode: number }> {
  const program = buildProgram({
    scan: { runner, resolveDefaultRegion: () => 'us-east-1' },
    risks: { runner, resolveDefaultRegion: () => 'us-east-1' },
    drift: { runner, resolveDefaultRegion: () => 'us-east-1' }
  })
  program.exitOverride()
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} })
  return program
    .parseAsync(['node', 'riftview', ...argv])
    .then(() => ({ caught: undefined, exitCode: 0 }))
    .catch((err: unknown) => ({ caught: err, exitCode: mapCommanderExit(err) }))
}

describe('exit code matrix', () => {
  it('EXIT.OK (0) — clean `scan --output json` run', async () => {
    const { exitCode } = await run(['scan', '--output', 'json'])
    expect(exitCode).toBe(EXIT.OK)
  })

  it('EXIT.OK (0) — `risks` without --fail-on, even with findings', async () => {
    const criticalNode: CloudNode = {
      id: 'fn-crit',
      type: 'lambda',
      label: 'crit',
      status: 'running',
      region: 'us-east-1',
      metadata: {}
    }
    const runner: ScanRunner = async () => ({
      nodes: [criticalNode],
      errors: [],
      durationMs: 1
    })
    const { exitCode } = await run(['risks', '--output', 'json'], runner)
    expect(exitCode).toBe(EXIT.OK)
  })

  it('EXIT.FINDINGS (1) — `risks --fail-on S2` trips on critical', async () => {
    const criticalNode: CloudNode = {
      id: 'fn-crit',
      type: 'lambda',
      label: 'crit',
      status: 'running',
      region: 'us-east-1',
      metadata: {}
    }
    const runner: ScanRunner = async () => ({
      nodes: [criticalNode],
      errors: [],
      durationMs: 1
    })
    const { exitCode } = await run(['risks', '--fail-on', 'S2', '--output', 'json'], runner)
    expect(exitCode).toBe(EXIT.FINDINGS)
  })

  it('EXIT.USAGE (2) — unknown subcommand', async () => {
    const { exitCode } = await run(['not-a-command'])
    expect(exitCode).toBe(EXIT.USAGE)
  })

  it('EXIT.USAGE (2) — missing --state on drift', async () => {
    const { exitCode } = await run(['drift', '--output', 'json'])
    expect(exitCode).toBe(EXIT.USAGE)
  })

  it('EXIT.USAGE (2) — unreadable snapshot for diff', async () => {
    const { exitCode } = await run([
      'diff',
      '/does/not/exist-a.json',
      '/does/not/exist-b.json',
      '--output',
      'json'
    ])
    expect(exitCode).toBe(EXIT.USAGE)
  })

  it('EXIT.USAGE (2) — invalid snapshot schemaVersion for risks --snapshot', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-exit-'))
    const bad = join(dir, 'future.json')
    writeFileSync(bad, JSON.stringify({ schemaVersion: 99, command: 'scan' }, null, 2), 'utf8')
    const { exitCode } = await run(['risks', '--snapshot', bad, '--output', 'json'])
    expect(exitCode).toBe(EXIT.USAGE)
  })

  it('EXIT.AUTH (3) — AWS credentials-expired classified by classifyScanError', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('The SSO session associated with this profile has expired')
    }
    const { exitCode } = await run(['scan', '--output', 'json'], runner)
    expect(exitCode).toBe(EXIT.AUTH)
  })

  it('EXIT.AUTH (3) — AccessDenied classified as permission → AuthError', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('AccessDenied: not authorized to perform ec2:DescribeInstances')
    }
    const { exitCode } = await run(['scan', '--output', 'json'], runner)
    expect(exitCode).toBe(EXIT.AUTH)
  })

  it('EXIT.RUNTIME (4) — unexpected error falls through to RuntimeError', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('some brand new failure nobody classified')
    }
    const { exitCode } = await run(['scan', '--output', 'json'], runner)
    expect(exitCode).toBe(EXIT.RUNTIME)
  })
})
