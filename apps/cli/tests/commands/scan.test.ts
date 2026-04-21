import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import type { CloudNode } from '@riftview/shared'
import { buildProgram } from '../../cli/index'
import { EXIT } from '../../cli/exitCodes'
import { mapCommanderExit } from '../../cli/exit-mapper'
import { SCHEMA_VERSION, type ScanOutput } from '../../cli/output/schema'
import type { ScanRunner, ScanRunnerResult } from '../../cli/commands/scan'

function lambdaNode(id: string, overrides: Partial<CloudNode> = {}): CloudNode {
  return {
    id,
    type: 'lambda',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { dlqArn: null, reservedConcurrency: null, ...(overrides.metadata ?? {}) },
    ...overrides
  }
}

function publicS3(id: string): CloudNode {
  return {
    id,
    type: 's3',
    label: id,
    status: 'running',
    region: 'us-east-1',
    metadata: { publicAccessBlock: false, versioning: false }
  }
}

function makeRunner(result: Partial<ScanRunnerResult> = {}): {
  runner: ScanRunner
  calls: Array<{ profile: string; regions: string[]; endpoint?: string }>
} {
  const calls: Array<{ profile: string; regions: string[]; endpoint?: string }> = []
  const runner: ScanRunner = async (input) => {
    calls.push(input)
    return {
      nodes: result.nodes ?? [],
      errors: result.errors ?? [],
      durationMs: result.durationMs ?? 10
    }
  }
  return { runner, calls }
}

function captureProgram(
  runner: ScanRunner,
  resolveDefaultRegion: (profile: string) => string = () => 'us-east-1'
): {
  program: ReturnType<typeof buildProgram>
  stdout: string[]
  stderr: string[]
} {
  const program = buildProgram({
    scan: {
      runner,
      resolveDefaultRegion,
      now: () => new Date('2026-04-20T12:00:00.000Z')
    }
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

describe('scan command', () => {
  beforeEach(() => {
    delete process.env.NO_COLOR
  })

  it('emits ScanOutput conforming to schema v1 with --output json', async () => {
    const { runner, calls } = makeRunner({
      nodes: [lambdaNode('fn-a'), publicS3('bucket-1')],
      durationMs: 123
    })
    const { program, stdout } = captureProgram(runner, () => 'us-east-1')

    await program.parseAsync(['node', 'riftview', 'scan', '--output', 'json'])

    expect(calls).toEqual([{ profile: 'default', regions: ['us-east-1'], endpoint: undefined }])
    const payload = JSON.parse(stdout.join('')) as ScanOutput
    expect(payload.schemaVersion).toBe(SCHEMA_VERSION)
    expect(payload.command).toBe('scan')
    expect(payload.profile).toBe('default')
    expect(payload.regions).toEqual(['us-east-1'])
    expect(payload.timestamp).toBe('2026-04-20T12:00:00.000Z')
    expect(payload.durationMs).toBe(123)
    expect(payload.nodes).toHaveLength(2)
    expect(Array.isArray(payload.edges)).toBe(true)
    expect(Array.isArray(payload.scanErrors)).toBe(true)
    expect(Array.isArray(payload.topRisks)).toBe(true)
    expect(payload.topRisks.length).toBeLessThanOrEqual(3)
  })

  it('flattens CloudNode.integrations into top-level edges', async () => {
    const a = lambdaNode('fn-a', {
      integrations: [{ targetId: 'queue-1', edgeType: 'trigger' }]
    })
    const { runner } = makeRunner({ nodes: [a] })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'scan', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as ScanOutput
    expect(payload.edges).toEqual([{ source: 'fn-a', target: 'queue-1', edgeType: 'trigger' }])
  })

  it('topRisks is severity-sorted and capped at 3', async () => {
    const nodes: CloudNode[] = [
      publicS3('bucket-public'), // critical + warning likely
      lambdaNode('fn-no-dlq'), // warning
      lambdaNode('fn-no-dlq-2'),
      lambdaNode('fn-no-dlq-3'),
      lambdaNode('fn-no-dlq-4')
    ]
    const { runner } = makeRunner({ nodes })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'scan', '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as ScanOutput
    expect(payload.topRisks.length).toBeLessThanOrEqual(3)
    const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 }
    for (let i = 1; i < payload.topRisks.length; i++) {
      expect(severityRank[payload.topRisks[i - 1].severity]).toBeLessThanOrEqual(
        severityRank[payload.topRisks[i].severity]
      )
    }
  })

  it('honours comma-separated --region list (opt-in multi-region)', async () => {
    const { runner, calls } = makeRunner()
    const { program } = captureProgram(runner)
    await program.parseAsync([
      'node',
      'riftview',
      'scan',
      '--region',
      'us-east-1,us-west-2',
      '--output',
      'json'
    ])
    expect(calls[0].regions).toEqual(['us-east-1', 'us-west-2'])
  })

  it('resolves default region from profile when --region omitted', async () => {
    const { runner, calls } = makeRunner()
    const { program } = captureProgram(runner, (p) => {
      expect(p).toBe('myprofile')
      return 'eu-west-1'
    })
    await program.parseAsync([
      'node',
      'riftview',
      'scan',
      '--profile',
      'myprofile',
      '--output',
      'json'
    ])
    expect(calls[0].profile).toBe('myprofile')
    expect(calls[0].regions).toEqual(['eu-west-1'])
  })

  it('writes a reloadable snapshot when --snapshot is passed', async () => {
    const nodes = [lambdaNode('fn-a')]
    const { runner } = makeRunner({ nodes, durationMs: 50 })
    const { program, stdout } = captureProgram(runner)
    const dir = mkdtempSync(join(tmpdir(), 'riftview-scan-'))
    const snapPath = join(dir, 'scan.json')
    await program.parseAsync([
      'node',
      'riftview',
      'scan',
      '--snapshot',
      snapPath,
      '--output',
      'json'
    ])

    const fileContents = readFileSync(snapPath, 'utf8')
    const fromDisk = JSON.parse(fileContents)
    const fromStdout = JSON.parse(stdout.join(''))
    expect(fromDisk).toEqual(fromStdout)
    expect(fromDisk.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('emits human-readable pretty output by default with no ANSI in non-TTY', async () => {
    process.env.NO_COLOR = '1'
    const { runner } = makeRunner({ nodes: [lambdaNode('fn-a')], durationMs: 500 })
    const { program, stdout } = captureProgram(runner)
    await program.parseAsync(['node', 'riftview', 'scan'])
    const text = stdout.join('')
    expect(text).toMatch(/riftview scan/)
    expect(text).toMatch(/lambda/)
    // No ANSI escape codes when NO_COLOR is set (ESC = 0x1B).
    // eslint-disable-next-line no-control-regex
    expect(text).not.toMatch(/\u001b\[/)
  })

  it('maps AWS credential-expired errors to EXIT.AUTH (3)', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('The SSO session associated with this profile has expired')
    }
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'scan', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.AUTH)
  })

  it('maps unexpected errors to EXIT.RUNTIME (4)', async () => {
    const runner: ScanRunner = async () => {
      throw new Error('Something strange happened inside scanOnce')
    }
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'scan', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.RUNTIME)
  })

  it('rejects empty --region with USAGE (2)', async () => {
    const { runner } = makeRunner()
    const { program } = captureProgram(runner)
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'scan', '--region', ',,', '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })
})
