import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import type { CloudNode } from '@riftview/shared'
import { buildProgram } from '../../cli/index'
import { EXIT } from '../../cli/exitCodes'
import { mapCommanderExit } from '../../cli/exit-mapper'
import { SCHEMA_VERSION, type DriftOutput } from '../../cli/output/schema'
import type { ScanRunner, ScanRunnerResult } from '../../cli/commands/scan'

// Fixture tfstate contains: aws_vpc(vpc-managed), aws_lambda_function(fn-managed),
// aws_s3_bucket(bucket-tf-only). First two are "managed"; the S3 bucket is
// "missing" (exists in TF but not in live scan).
const FIXTURE = resolve(__dirname, '../fixtures/tfstate/basic.tfstate.json')

function vpc(id: string): CloudNode {
  return {
    id,
    type: 'aws:vpc',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {}
  }
}

function lambdaNode(id: string): CloudNode {
  return {
    id,
    type: 'aws:lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { timeout: 30 }
  }
}

function ec2(id: string): CloudNode {
  return {
    id,
    type: 'aws:ec2',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: {}
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
    risks: { runner, resolveDefaultRegion: () => 'us-east-1' },
    drift: { runner, resolveDefaultRegion: () => 'us-east-1' }
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

describe('drift command', () => {
  beforeEach(() => {
    delete process.env.NO_COLOR
  })

  it('emits DriftOutput conforming to schema v1 with --output json', async () => {
    // Live matches both managed resources and has one unmanaged EC2.
    const runner = makeRunner({
      nodes: [vpc('vpc-managed'), lambdaNode('fn-managed'), ec2('i-unmanaged')]
    })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'drift', '--state', FIXTURE, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DriftOutput
    expect(payload.schemaVersion).toBe(SCHEMA_VERSION)
    expect(payload.command).toBe('drift')
    expect(payload.statePath).toBe(FIXTURE)
    expect(payload.counts.matched).toBe(2) // vpc-managed + fn-managed
    expect(payload.unmanaged.map((n) => n.id)).toEqual(['i-unmanaged'])
    expect(payload.missing.map((n) => n.id)).toEqual(['bucket-tf-only'])
    expect(payload.exitCode).toBe(0)
  })

  it('clean drift (live === tf) → counts all matched, zero unmanaged/missing', async () => {
    const runner = makeRunner({
      nodes: [
        vpc('vpc-managed'),
        lambdaNode('fn-managed'),
        {
          id: 'bucket-tf-only',
          type: 'aws:s3',
          label: 'bucket-tf-only',
          status: 'running',
          region: 'us-east-1',
          metadata: {}
        }
      ]
    })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'drift', '--state', FIXTURE, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DriftOutput
    expect(payload.unmanaged).toHaveLength(0)
    expect(payload.missing).toHaveLength(0)
    expect(payload.counts.matched).toBe(3)
  })

  it('--fail-on-drift + any drift → EXIT.FINDINGS (1)', async () => {
    const runner = makeRunner({ nodes: [ec2('i-unmanaged')] })
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync([
        'node',
        'riftview',
        'drift',
        '--state',
        FIXTURE,
        '--fail-on-drift',
        '--output',
        'json'
      ])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.FINDINGS)
  })

  it('--fail-on-drift + no drift → exit 0', async () => {
    const runner = makeRunner({
      nodes: [
        vpc('vpc-managed'),
        lambdaNode('fn-managed'),
        {
          id: 'bucket-tf-only',
          type: 'aws:s3',
          label: 'bucket-tf-only',
          status: 'running',
          region: 'us-east-1',
          metadata: {}
        }
      ]
    })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync([
      'node',
      'riftview',
      'drift',
      '--state',
      FIXTURE,
      '--fail-on-drift',
      '--output',
      'json'
    ])
    const payload = JSON.parse(stdout.join('')) as DriftOutput
    expect(payload.exitCode).toBe(0)
  })

  it('without --fail-on-drift, drift does not change exit code', async () => {
    const runner = makeRunner({ nodes: [ec2('i-unmanaged')] })
    const { program, stdout } = captureProgram(runner)
    // Must not throw.
    await program.parseAsync(['node', 'riftview', 'drift', '--state', FIXTURE, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DriftOutput
    expect(payload.unmanaged.length + payload.missing.length).toBeGreaterThan(0)
    expect(payload.exitCode).toBe(0)
  })

  it('missing --state argument → EXIT.USAGE (2)', async () => {
    const runner = makeRunner()
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'drift', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('unreadable --state path → EXIT.USAGE (2)', async () => {
    const runner = makeRunner()
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync([
        'node',
        'riftview',
        'drift',
        '--state',
        '/nope/does/not/exist.tfstate.json',
        '--output',
        'json'
      ])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('invalid tfstate JSON → EXIT.USAGE (2)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-drift-'))
    const bad = join(dir, 'bad.tfstate.json')
    writeFileSync(bad, 'not valid json', 'utf8')
    const runner = makeRunner()
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'drift', '--state', bad, '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('pretty output shows matched / unmanaged / missing sections, no ANSI in non-TTY', async () => {
    process.env.NO_COLOR = '1'
    const runner = makeRunner({
      nodes: [vpc('vpc-managed'), lambdaNode('fn-managed'), ec2('i-unmanaged')]
    })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'drift', '--state', FIXTURE])
    const text = stdout.join('')
    expect(text).toMatch(/matched/i)
    expect(text).toMatch(/unmanaged/i)
    expect(text).toMatch(/missing/i)
    expect(text).toMatch(/i-unmanaged/)
    expect(text).toMatch(/bucket-tf-only/)
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/\u001b\[/)
  })

  it('maps AWS auth errors to EXIT.AUTH (3)', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('The SSO session associated with this profile has expired')
    }
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync([
        'node',
        'riftview',
        'drift',
        '--state',
        FIXTURE,
        '--output',
        'json'
      ])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.AUTH)
  })
})
