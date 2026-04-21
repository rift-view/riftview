import { describe, it, expect } from 'vitest'
import { resolve } from 'node:path'
import { runCli } from './helpers/run-cli'

const SNAP_A = resolve(__dirname, 'fixtures', 'snapshots', 'snap-a.json')
const SNAP_B = resolve(__dirname, 'fixtures', 'snapshots', 'snap-b.json')

describe('riftview diff — snapshot pair integration', () => {
  it('reports the known delta between snap-a and snap-b', () => {
    // Note: `diff` always exits 0 regardless of delta content — it is
    // informational. Content assertions below are the real test.
    const { status, stdout, stderr } = runCli([
      'diff',
      SNAP_A,
      SNAP_B,
      '--output',
      'json'
    ])

    if (status !== 0) {
      throw new Error(`diff exited ${status}\nstderr:\n${stderr}\nstdout:\n${stdout}`)
    }

    const payload = JSON.parse(stdout) as {
      schemaVersion: number
      command: string
      added: Array<{ id: string }>
      removed: Array<{ id: string }>
      changed: Array<{ id: string; fields: Array<{ field: string }> }>
    }

    expect(payload.schemaVersion).toBe(1)
    expect(payload.command).toBe('diff')

    expect(payload.added.map((n) => n.id)).toEqual(['i-added'])
    expect(payload.removed.map((n) => n.id)).toEqual(['i-removed'])
    expect(payload.changed.map((n) => n.id)).toEqual(['fn-changed'])

    // The changed node's memorySize should appear in the field-level
    // diff. Field key format comes from `fieldDiff` in diff.ts —
    // metadata fields are prefixed with 'metadata.' (one-level flatten).
    const changedFields = payload.changed[0].fields.map((f) => f.field)
    expect(changedFields).toContain('metadata.memorySize')

    const memDiff = payload.changed[0].fields.find((f) => f.field === 'metadata.memorySize') as
      | { field: string; before: unknown; after: unknown }
      | undefined
    expect(memDiff?.before).toBe(128)
    expect(memDiff?.after).toBe(512)
  })
})
