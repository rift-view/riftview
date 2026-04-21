import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { runCli } from './helpers/run-cli'

const STATE_FIXTURE = resolve(__dirname, 'fixtures', 'drifted.tfstate')

describe('riftview drift --fail-on-drift — LocalStack integration', () => {
  it('exits 1 when drifted.tfstate contains a resource absent from the live scan', () => {
    const { status, stdout } = runCli([
      'drift',
      '--profile',
      'integration',
      '--region',
      'us-east-1',
      '--endpoint',
      'http://localhost:4566',
      '--state',
      STATE_FIXTURE,
      '--fail-on-drift',
      '--output',
      'json'
    ])

    // Exit 1 is expected ONLY when JSON parses — a crash returns >1.
    expect(status).toBe(1)

    const payload = JSON.parse(stdout) as {
      schemaVersion: number
      command: string
      missing: Array<{ id: string; type: string }>
      counts: { missing: number; unmanaged: number; matched: number }
      exitCode: number
    }

    expect(payload.schemaVersion).toBe(1)
    expect(payload.command).toBe('drift')
    expect(payload.exitCode).toBe(1)

    // drifted.tfstate references exactly one ghost bucket; the drift
    // engine must place it in `missing` (tfstate has it, live doesn't).
    const missingIds = payload.missing.map((n) => n.id)
    expect(missingIds).toContain('rv-ghost-bucket')
    expect(payload.counts.missing).toBeGreaterThanOrEqual(1)
  })

  it('exits 0 when --fail-on-drift is omitted, even with detected drift', () => {
    const { status } = runCli([
      'drift',
      '--profile',
      'integration',
      '--region',
      'us-east-1',
      '--endpoint',
      'http://localhost:4566',
      '--state',
      STATE_FIXTURE,
      '--output',
      'json'
    ])

    // Without --fail-on-drift, drift is reported but the gate is closed.
    expect(status).toBe(0)
  })
})
