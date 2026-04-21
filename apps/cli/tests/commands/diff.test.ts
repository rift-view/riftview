import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildProgram } from '../../cli/index'
import { EXIT } from '../../cli/exitCodes'
import { mapCommanderExit } from '../../cli/exit-mapper'
import { SCHEMA_VERSION, type DiffOutput } from '../../cli/output/schema'

const FIXTURE_A = resolve(__dirname, '../fixtures/snapshots/a.json')
const FIXTURE_B = resolve(__dirname, '../fixtures/snapshots/b.json')

function captureProgram(): {
  program: ReturnType<typeof buildProgram>
  stdout: string[]
  stderr: string[]
} {
  const program = buildProgram()
  program.exitOverride()
  const stdout: string[] = []
  const stderr: string[] = []
  program.configureOutput({
    writeOut: (s) => stdout.push(s),
    writeErr: (s) => stderr.push(s)
  })
  return { program, stdout, stderr }
}

describe('diff command', () => {
  it('emits DiffOutput conforming to schema v1 with --output json', async () => {
    const { program, stdout } = captureProgram()
    await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_B, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DiffOutput
    expect(payload.schemaVersion).toBe(SCHEMA_VERSION)
    expect(payload.command).toBe('diff')
    expect(payload.a).toBe(FIXTURE_A)
    expect(payload.b).toBe(FIXTURE_B)
    expect(Array.isArray(payload.added)).toBe(true)
    expect(Array.isArray(payload.removed)).toBe(true)
    expect(Array.isArray(payload.changed)).toBe(true)
  })

  it('reports added nodes (in b but not in a)', async () => {
    const { program, stdout } = captureProgram()
    await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_B, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DiffOutput
    expect(payload.added.map((n) => n.id)).toEqual(['i-added'])
  })

  it('reports removed nodes (in a but not in b)', async () => {
    const { program, stdout } = captureProgram()
    await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_B, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DiffOutput
    expect(payload.removed.map((n) => n.id)).toEqual(['i-removed'])
  })

  it('reports changed nodes with field-level diffs', async () => {
    const { program, stdout } = captureProgram()
    await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_B, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DiffOutput
    expect(payload.changed).toHaveLength(1)
    const fn = payload.changed[0]
    expect(fn.id).toBe('fn-changed')
    const fields = Object.fromEntries(
      fn.fields.map((f) => [f.field, { before: f.before, after: f.after }])
    )
    expect(fields.label).toEqual({ before: 'api', after: 'api-v2' })
    expect(fields['metadata.timeout']).toEqual({ before: 10, after: 30 })
    expect(fields['metadata.memorySize']).toEqual({ before: 128, after: 512 })
  })

  it('stable nodes appear in neither added/removed/changed', async () => {
    const { program, stdout } = captureProgram()
    await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_B, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DiffOutput
    const touched = new Set([
      ...payload.added.map((n) => n.id),
      ...payload.removed.map((n) => n.id),
      ...payload.changed.map((c) => c.id)
    ])
    expect(touched.has('i-stable')).toBe(false)
  })

  it('a === b → empty added/removed/changed, exit 0', async () => {
    const { program, stdout } = captureProgram()
    await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_A, '--output', 'json'])
    const payload = JSON.parse(stdout.join('')) as DiffOutput
    expect(payload.added).toHaveLength(0)
    expect(payload.removed).toHaveLength(0)
    expect(payload.changed).toHaveLength(0)
  })

  it('missing snapshot file → EXIT.USAGE (2)', async () => {
    const { program } = captureProgram()
    let caught: unknown
    try {
      await program.parseAsync([
        'node',
        'riftview',
        'diff',
        FIXTURE_A,
        '/nope/does/not/exist.json',
        '--output',
        'json'
      ])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('invalid JSON → EXIT.USAGE (2)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-diff-'))
    const bad = join(dir, 'broken.json')
    writeFileSync(bad, 'not json at all', 'utf8')
    const { program } = captureProgram()
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, bad, '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('mismatched schemaVersion → EXIT.USAGE (2)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'riftview-diff-'))
    const futureSnap = join(dir, 'future.json')
    writeFileSync(
      futureSnap,
      JSON.stringify(
        {
          schemaVersion: 99,
          command: 'scan',
          profile: 'default',
          regions: ['us-east-1'],
          timestamp: '2026-04-20T12:00:00.000Z',
          durationMs: 0,
          nodes: [],
          edges: [],
          scanErrors: [],
          topRisks: []
        },
        null,
        2
      ),
      'utf8'
    )
    const { program } = captureProgram()
    let caught: unknown
    try {
      await program.parseAsync([
        'node',
        'riftview',
        'diff',
        FIXTURE_A,
        futureSnap,
        '--output',
        'json'
      ])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('missing positional arg → EXIT.USAGE (2)', async () => {
    const { program } = captureProgram()
    let caught: unknown
    try {
      await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, '--output', 'json'])
    } catch (err) {
      caught = err
    }
    expect(mapCommanderExit(caught)).toBe(EXIT.USAGE)
  })

  it('pretty output shows three sections with no ANSI in non-TTY', async () => {
    process.env.NO_COLOR = '1'
    try {
      const { program, stdout } = captureProgram()
      await program.parseAsync(['node', 'riftview', 'diff', FIXTURE_A, FIXTURE_B])
      const text = stdout.join('')
      expect(text).toMatch(/added/i)
      expect(text).toMatch(/removed/i)
      expect(text).toMatch(/changed/i)
      expect(text).toMatch(/i-added/)
      expect(text).toMatch(/i-removed/)
      expect(text).toMatch(/fn-changed/)
      // eslint-disable-next-line no-control-regex
      expect(text).not.toMatch(/\u001b\[/)
    } finally {
      delete process.env.NO_COLOR
    }
  })
})
