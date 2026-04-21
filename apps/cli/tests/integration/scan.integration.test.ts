import { describe, it, expect } from 'vitest'
import { runCli } from './helpers/run-cli'

describe('riftview scan — LocalStack integration', () => {
  it('exits 0 and emits ScanOutput with non-empty nodes', () => {
    const { status, stdout, stderr } = runCli([
      'scan',
      '--profile',
      'integration',
      '--region',
      'us-east-1',
      '--endpoint',
      'http://localhost:4566',
      '--output',
      'json'
    ])

    // Surface stderr on failure for fast triage.
    if (status !== 0) {
      throw new Error(`scan exited ${status}\nstderr:\n${stderr}\nstdout:\n${stdout}`)
    }

    const payload = JSON.parse(stdout) as {
      schemaVersion: number
      command: string
      nodes: Array<{ id: string; type: string }>
    }

    expect(payload.schemaVersion).toBe(1)
    expect(payload.command).toBe('scan')
    expect(Array.isArray(payload.nodes)).toBe(true)
    expect(payload.nodes.length).toBeGreaterThan(0)
  })

  it('scans resources from seed.tf (ec2, lambda, s3 at minimum)', () => {
    const { status, stdout } = runCli([
      'scan',
      '--profile',
      'integration',
      '--region',
      'us-east-1',
      '--endpoint',
      'http://localhost:4566',
      '--output',
      'json'
    ])

    expect(status).toBe(0)
    const payload = JSON.parse(stdout) as {
      nodes: Array<{ id: string; type: string; label: string }>
    }

    const types = new Set(payload.nodes.map((n) => n.type))
    // Three must-have types from seed.tf — a canary for the scan pipeline.
    // Not an exhaustive check; that would couple the test too tightly to
    // the current NodeType coverage of LocalStack Community-Archive.
    expect(types).toContain('ec2')
    expect(types).toContain('lambda')
    expect(types).toContain('s3')
  })
})
