import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import type { CloudNode } from '@riftview/shared'
import { buildProgram } from '../../cli/index'
import { EXIT } from '../../cli/exitCodes'
import { mapCommanderExit } from '../../cli/exit-mapper'
import { SCHEMA_VERSION, type RisksOutput, type ScanOutput } from '../../cli/output/schema'
import type { ScanRunner, ScanRunnerResult } from '../../cli/commands/scan'

// ── Fixture helpers ──────────────────────────────────────────────────────────
// Public SSH + no timeout on lambda fires critical advisories via analyzeNode.
// A bare lambda (no timeout set) fires `lambda-no-timeout` (critical).
// Adjust metadata as needed to drive specific severities.
function lambdaNoTimeout(id: string): CloudNode {
  return {
    id,
    type: 'lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {}
  }
}

// Lambda with a timeout set but writes to an SQS queue with no DLQ →
// analyzeGraph fires `lambda-sqs-no-dlq` (warning) only; no critical from analyzeNode.
function lambdaWarnOnly(id: string, queueId: string): CloudNode {
  return {
    id,
    type: 'lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { timeout: 30, reservedConcurrentExecutions: 5 },
    integrations: [{ targetId: queueId, edgeType: 'trigger' }]
  }
}

function sqsNoDlq(id: string): CloudNode {
  return {
    id,
    type: 'sqs',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { hasDlq: false }
  }
}

// Lambda with high memory + timeout + no SQS target → no advisories at all.
function lambdaClean(id: string): CloudNode {
  return {
    id,
    type: 'lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { timeout: 30, memorySize: 1024, reservedConcurrentExecutions: 5 }
  }
}

function makeRunner(result: Partial<ScanRunnerResult> = {}): ScanRunner {
  return async () => ({
    nodes: result.nodes ?? [],
    errors: result.errors ?? [],
    durationMs: result.durationMs ?? 5
  })
}

function captureProgram(runner: ScanRunner): {
  program: ReturnType<typeof buildProgram>
  stdout: string[]
  stderr: string[]
} {
  const program = buildProgram({
    scan: { runner, resolveDefaultRegion: () => 'us-east-1' },
    risks: { runner, resolveDefaultRegion: () => 'us-east-1' }
  })
  program.exitOverride()
  const stdout: string[] = []
  const stderr: string[] = []
  program.configureOutput({
    writeOut: (s) => stdout.push(s),
    writeErr: (s) => stderr.push(s)
  })
  return { program, stdout, stderr }
}

function makeScanSnapshot(nodes: CloudNode[]): ScanOutput {
  return {
    schemaVersion: SCHEMA_VERSION,
    command: 'scan',
    profile: 'default',
    regions: ['us-east-1'],
    timestamp: '2026-04-20T12:00:00.000Z',
    durationMs: 10,
    nodes,
    edges: [],
    scanErrors: [],
    topRisks: []
  }
}

describe('risks command', () => {
  beforeEach(() => {
    delete process.env.NO_COLOR
  })

  it('emits RisksOutput conforming to schema v1 with --output json', async () => {
    const runner = makeRunner({ nodes: [lambdaNoTimeout('fn-a')] })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'risks', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    expect(payload.schemaVersion).toBe(SCHEMA_VERSION)
    expect(payload.command).toBe('risks')
    expect(payload.source).toBe('scan')
    expect(payload.counts).toEqual({ critical: 1, warning: 0, info: 0 })
    expect(payload.advisories).toHaveLength(1)
    expect(payload.advisories[0].id).toBe('lambda-no-timeout:fn-a')
  })

  it('decorates every advisory with composite id ${ruleId}:${nodeId}', async () => {
    const queue = sqsNoDlq('q-1')
    const runner = makeRunner({ nodes: [lambdaWarnOnly('fn-a', 'q-1'), queue] })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'risks', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    for (const f of payload.advisories) {
      expect(f.id).toBe(`${f.ruleId}:${f.nodeId}`)
    }
  })

  it('sorts advisories by severity (critical first)', async () => {
    const nodes = [lambdaNoTimeout('fn-crit'), lambdaWarnOnly('fn-warn', 'q-1'), sqsNoDlq('q-1')]
    const runner = makeRunner({ nodes })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'risks', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    for (let i = 1; i < payload.advisories.length; i++) {
      expect(order[payload.advisories[i - 1].severity]).toBeLessThanOrEqual(
        order[payload.advisories[i].severity]
      )
    }
  })

  it('--fail-on S2 + critical advisory → EXIT.FINDINGS (1)', async () => {
    const runner = makeRunner({ nodes: [lambdaNoTimeout('fn-a')] })
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'risks', '--fail-on', 'S2', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.FINDINGS)
  })

  it('--fail-on S1 + only warnings → exit 0 (warnings do not trip S1 gate)', async () => {
    const runner = makeRunner({ nodes: [lambdaWarnOnly('fn-a', 'q-1'), sqsNoDlq('q-1')] })
    const { program, stdout } = captureProgram(runner)
    // Must not throw
    await program.parseAsync(['node', 'riftview', 'risks', '--fail-on', 'S1', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    expect(payload.counts.warning).toBeGreaterThan(0)
    expect(payload.counts.critical).toBe(0)
    expect(payload.exitCode).toBe(0)
  })

  it('no --fail-on → exit 0 even with critical findings', async () => {
    const runner = makeRunner({ nodes: [lambdaNoTimeout('fn-a')] })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'risks', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    expect(payload.counts.critical).toBeGreaterThan(0)
    expect(payload.exitCode).toBe(0)
    expect(payload.failOn).toBeUndefined()
  })

  it('--fail-on S3 trips on any finding (critical, warning, OR info)', async () => {
    const runner = makeRunner({ nodes: [lambdaWarnOnly('fn-a', 'q-1'), sqsNoDlq('q-1')] })
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'risks', '--fail-on', 'S3', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.FINDINGS)
  })

  it('clean scan with any --fail-on → exit 0', async () => {
    const runner = makeRunner({ nodes: [lambdaClean('fn-ok')] })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'risks', '--fail-on', 'S3', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    expect(payload.advisories).toHaveLength(0)
    expect(payload.exitCode).toBe(0)
  })

  it('--snapshot reads ScanOutput from disk and sets source=snapshot', async () => {
    // Runner must NOT be called when --snapshot is given; wire a throwing runner.
    const throwingRunner: ScanRunner = async () => {
      throw new Error('runner should not be called when --snapshot is provided')
    }
    const dir = mkdtempSync(join(tmpdir(), 'riftview-risks-'))
    const snapPath = join(dir, 'scan.json')
    writeFileSync(
      snapPath,
      JSON.stringify(makeScanSnapshot([lambdaNoTimeout('fn-s')]), null, 2),
      'utf8'
    )
    const { program, stdout } = captureProgram(throwingRunner)
    await program.parseAsync([
      'node',
      'riftview',
      'risks',
      '--snapshot',
      snapPath,
      '--output',
      'json'
    ])
    const payload = JSON.parse(stdout.join('')) as RisksOutput
    expect(payload.source).toBe('snapshot')
    expect(payload.snapshotPath).toBe(snapPath)
    expect(payload.advisories[0].id).toBe('lambda-no-timeout:fn-s')
  })

  it('--snapshot with missing file → EXIT.USAGE (2)', async () => {
    const runner = makeRunner()
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync([
        'node',
        'riftview',
        'risks',
        '--snapshot',
        '/nope/does/not/exist.json',
        '--output',
        'json'
      ])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('pretty output lists severity + ruleId + title + nodeId with no ANSI in non-TTY', async () => {
    process.env.NO_COLOR = '1'
    const runner = makeRunner({ nodes: [lambdaNoTimeout('fn-pretty')] })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'risks'])
    const text = stdout.join('')
    expect(text).toMatch(/lambda-no-timeout/)
    expect(text).toMatch(/fn-pretty/)
    expect(text).toMatch(/No timeout configured/)
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/\u001b\[/)
  })

  it('rejects invalid --fail-on value with EXIT.USAGE (2)', async () => {
    const runner = makeRunner()
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'risks', '--fail-on', 'S9', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('maps AWS auth errors from a fresh scan to EXIT.AUTH (3)', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('The SSO session associated with this profile has expired')
    }
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'risks', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.AUTH)
  })
})
