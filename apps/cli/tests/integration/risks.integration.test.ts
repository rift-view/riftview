import { describe, it, expect } from 'vitest'
import { runCli } from './helpers/run-cli'

describe('riftview risks — LocalStack integration', () => {
  it('exits 0 and emits RisksOutput with schemaVersion 1', () => {
    const { status, stdout, stderr } = runCli([
      'risks',
      '--profile',
      'integration',
      '--region',
      'us-east-1',
      '--endpoint',
      'http://localhost:4566',
      '--output',
      'json'
    ])

    if (status !== 0) {
      throw new Error(`risks exited ${status}\nstderr:\n${stderr}\nstdout:\n${stdout}`)
    }

    const payload = JSON.parse(stdout) as {
      schemaVersion: number
      command: string
      source: string
      advisories: Array<{
        id: string
        ruleId: string
        severity: string
        title: string
        detail: string
        nodeId: string
      }>
      counts: { critical: number; warning: number; info: number }
      exitCode: number
    }

    expect(payload.schemaVersion).toBe(1)
    expect(payload.command).toBe('risks')
    expect(Array.isArray(payload.advisories)).toBe(true)

    // Every advisory must conform to the schema — seed.tf is intentionally
    // benign, but scannable resources do surface default-config warnings
    // (e.g. `s3-no-versioning`), so we expect non-empty in practice.
    for (const advisory of payload.advisories) {
      expect(typeof advisory.id).toBe('string')
      expect(typeof advisory.ruleId).toBe('string')
      expect(['critical', 'warning', 'info']).toContain(advisory.severity)
      expect(typeof advisory.nodeId).toBe('string')
    }

    expect(payload.counts).toEqual({
      critical: expect.any(Number),
      warning: expect.any(Number),
      info: expect.any(Number)
    })
  })
})
