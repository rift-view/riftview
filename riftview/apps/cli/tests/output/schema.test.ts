// Schema v1 regression guard. Every output interface is mirrored here as a
// `FrozenV1*` type. `expectTypeOf<Actual>().toEqualTypeOf<FrozenV1>()` is a
// two-way equality check — any field added, removed, renamed, or widened
// in the live schema.ts fails TypeScript compilation of this test file.
//
// **To intentionally evolve the schema:**
//   1. Bump `SCHEMA_VERSION` in schema.ts (e.g. to 2)
//   2. Also bump the `schemaVersion` literal in each `FrozenV1*` below (or
//      split into FrozenV1/FrozenV2)
//   3. Update `readSnapshot()` accepted versions
//   4. Update docs/cli.md "JSON schema reference" section
//
// This file is a stability contract for CI consumers — treat it like a public
// API breakage test.

import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, expectTypeOf } from 'vitest'
import type { Advisory, CloudNode, EdgeType, ScanError } from '@riftview/shared'
import { buildProgram } from '../../cli/index'
import type { ScanRunner } from '../../cli/commands/scan'
import {
  SCHEMA_VERSION,
  type DiffOutput,
  type DriftOutput,
  type Finding,
  type OutputIntegrationEdge,
  type RisksOutput,
  type ScanOutput,
  type VersionOutput
} from '../../cli/output/schema'

// ── Frozen v1 expected shapes ────────────────────────────────────────────────
// These mirror schema.ts field-for-field. Do NOT edit to match a drift —
// if the live schema changes, bump SCHEMA_VERSION instead.

interface FrozenV1OutputIntegrationEdge {
  source: string
  target: string
  edgeType: EdgeType
}

interface FrozenV1ScanOutput {
  schemaVersion: 1
  command: 'scan'
  profile: string
  regions: string[]
  endpoint?: string
  timestamp: string
  durationMs: number
  nodes: CloudNode[]
  edges: FrozenV1OutputIntegrationEdge[]
  scanErrors: ScanError[]
  topRisks: Advisory[]
}

interface FrozenV1Finding extends Advisory {
  id: string
}

interface FrozenV1RisksOutput {
  schemaVersion: 1
  command: 'risks'
  source: 'scan' | 'snapshot'
  snapshotPath?: string
  advisories: FrozenV1Finding[]
  counts: { critical: number; warning: number; info: number }
  failOn?: 'S1' | 'S2' | 'S3'
  exitCode: number
}

interface FrozenV1DriftOutput {
  schemaVersion: 1
  command: 'drift'
  statePath: string
  matched: string[]
  unmanaged: CloudNode[]
  missing: CloudNode[]
  counts: { matched: number; unmanaged: number; missing: number }
  exitCode: number
}

interface FrozenV1DiffChange {
  id: string
  fields: Array<{ field: string; before: unknown; after: unknown }>
}

interface FrozenV1DiffOutput {
  schemaVersion: 1
  command: 'diff'
  a: string
  b: string
  added: CloudNode[]
  removed: CloudNode[]
  changed: FrozenV1DiffChange[]
}

interface FrozenV1VersionOutput {
  schemaVersion: 1
  command: 'version'
  version: string
  commit: string
  buildDate: string
  node: string
}

// ── Runtime fixtures ─────────────────────────────────────────────────────────

function makeRunner(nodes: CloudNode[] = []): ScanRunner {
  return async () => ({ nodes, errors: [], durationMs: 1 })
}

function captureProgram(): {
  program: ReturnType<typeof buildProgram>
  stdout: string[]
} {
  const runner = makeRunner()
  const program = buildProgram({
    scan: { runner, resolveDefaultRegion: () => 'us-east-1' },
    risks: { runner, resolveDefaultRegion: () => 'us-east-1' },
    drift: { runner, resolveDefaultRegion: () => 'us-east-1' }
  })
  program.exitOverride()
  const stdout: string[] = []
  program.configureOutput({ writeOut: (s) => stdout.push(s), writeErr: () => {} })
  return { program, stdout }
}

describe('output schema v1', () => {
  // ── Runtime contract ──────────────────────────────────────────────────────

  it('freezes SCHEMA_VERSION at 1', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })

  it('every subcommand emits schemaVersion: 1 in --output json', async () => {
    // scan
    {
      const { program, stdout } = captureProgram()
      await program.parseAsync(['node', 'r', 'scan', '--output', 'json'])
      expect(JSON.parse(stdout.join('')).schemaVersion).toBe(1)
    }
    // risks
    {
      const { program, stdout } = captureProgram()
      await program.parseAsync(['node', 'r', 'risks', '--output', 'json'])
      expect(JSON.parse(stdout.join('')).schemaVersion).toBe(1)
    }
    // version
    {
      const { program, stdout } = captureProgram()
      await program.parseAsync(['node', 'r', 'version', '--output', 'json'])
      expect(JSON.parse(stdout.join('')).schemaVersion).toBe(1)
    }
    // drift: needs a tfstate file
    {
      const dir = mkdtempSync(join(tmpdir(), 'riftview-schema-'))
      const statePath = join(dir, 'empty.tfstate.json')
      // Minimal valid tfstate
      const fs = await import('node:fs')
      fs.writeFileSync(statePath, JSON.stringify({ version: 4, resources: [] }, null, 2), 'utf8')
      const { program, stdout } = captureProgram()
      await program.parseAsync(['node', 'r', 'drift', '--state', statePath, '--output', 'json'])
      expect(JSON.parse(stdout.join('')).schemaVersion).toBe(1)
    }
    // diff: needs two snapshots
    {
      const dir = mkdtempSync(join(tmpdir(), 'riftview-schema-'))
      const snapPath = join(dir, 'scan.json')
      const { program, stdout } = captureProgram()
      await program.parseAsync(['node', 'r', 'scan', '--snapshot', snapPath, '--output', 'json'])
      // sanity: snapshot file contains schemaVersion 1
      expect(JSON.parse(readFileSync(snapPath, 'utf8')).schemaVersion).toBe(1)
      const { program: p2, stdout: out2 } = captureProgram()
      await p2.parseAsync(['node', 'r', 'diff', snapPath, snapPath, '--output', 'json'])
      expect(JSON.parse(out2.join('')).schemaVersion).toBe(1)
      // reference the first stdout so the linter doesn't complain about it being unused
      expect(stdout.length).toBeGreaterThan(0)
    }
  })

  // ── Type-level regression guard ───────────────────────────────────────────

  it('ScanOutput shape matches the frozen v1 contract', () => {
    expectTypeOf<ScanOutput>().toEqualTypeOf<FrozenV1ScanOutput>()
    expectTypeOf<OutputIntegrationEdge>().toEqualTypeOf<FrozenV1OutputIntegrationEdge>()
  })

  it('RisksOutput shape matches the frozen v1 contract', () => {
    expectTypeOf<RisksOutput>().toEqualTypeOf<FrozenV1RisksOutput>()
    expectTypeOf<Finding>().toEqualTypeOf<FrozenV1Finding>()
  })

  it('DriftOutput shape matches the frozen v1 contract', () => {
    expectTypeOf<DriftOutput>().toEqualTypeOf<FrozenV1DriftOutput>()
  })

  it('DiffOutput shape matches the frozen v1 contract', () => {
    expectTypeOf<DiffOutput>().toEqualTypeOf<FrozenV1DiffOutput>()
  })

  it('VersionOutput shape matches the frozen v1 contract', () => {
    expectTypeOf<VersionOutput>().toEqualTypeOf<FrozenV1VersionOutput>()
  })

  it('schemaVersion field is literally 1 across every output', () => {
    expectTypeOf<ScanOutput['schemaVersion']>().toEqualTypeOf<1>()
    expectTypeOf<RisksOutput['schemaVersion']>().toEqualTypeOf<1>()
    expectTypeOf<DriftOutput['schemaVersion']>().toEqualTypeOf<1>()
    expectTypeOf<DiffOutput['schemaVersion']>().toEqualTypeOf<1>()
    expectTypeOf<VersionOutput['schemaVersion']>().toEqualTypeOf<1>()
  })

  it('command field is a specific literal per output', () => {
    expectTypeOf<ScanOutput['command']>().toEqualTypeOf<'scan'>()
    expectTypeOf<RisksOutput['command']>().toEqualTypeOf<'risks'>()
    expectTypeOf<DriftOutput['command']>().toEqualTypeOf<'drift'>()
    expectTypeOf<DiffOutput['command']>().toEqualTypeOf<'diff'>()
    expectTypeOf<VersionOutput['command']>().toEqualTypeOf<'version'>()
  })
})
