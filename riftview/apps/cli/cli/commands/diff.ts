// `riftview diff <a> <b>` — structural diff of two scan snapshots.
// Emits added / removed / changed with field-level deltas. Always exits 0
// regardless of content (informational); CI pipelines compose their own
// gating by piping JSON through jq / shell.
import type { Command } from 'commander'
import type { CloudNode } from '@riftview/shared'
import { UsageError } from '../errors'
import { toJson } from '../output/json'
import { formatDiff } from '../output/pretty-diff'
import type { DiffChange, DiffOutput, ScanOutput } from '../output/schema'
import { SCHEMA_VERSION } from '../output/schema'
import { readSnapshot } from '../snapshot'

export interface DiffDeps {
  /** Override snapshot reader — tests stub this. */
  readSnapshot?: (path: string) => ReturnType<typeof readSnapshot>
}

export function registerDiff(program: Command, deps: DiffDeps = {}): void {
  const readSnap = deps.readSnapshot ?? readSnapshot

  program
    .command('diff')
    .description('diff two scan snapshots (--snapshot files from `riftview scan`)')
    // Positional args marked optional and validated manually — commander's
    // <required> enforcement calls process.exit on subcommands even when
    // exitOverride() is set on the root program. Matches the same trade-off
    // scan/risks/drift make for options.
    .argument('[a]', 'path to the baseline ScanOutput snapshot')
    .argument('[b]', 'path to the updated ScanOutput snapshot')
    .action(async (a: string | undefined, b: string | undefined) => {
      if (!a || !b) {
        throw new UsageError('`diff` requires two positional arguments: <a> <b>')
      }
      const snapA = readSnap(a)
      const snapB = readSnap(b)

      const output: DiffOutput = {
        schemaVersion: SCHEMA_VERSION,
        command: 'diff',
        a,
        b,
        ...computeDiff(snapA, snapB)
      }

      const cfg = (
        program as unknown as {
          _outputConfiguration: { writeOut: (s: string) => void }
        }
      )._outputConfiguration
      const format = ((program.opts().output as string) ?? 'pretty') as 'pretty' | 'json'
      if (format === 'json') {
        cfg.writeOut(toJson(output) + '\n')
      } else {
        cfg.writeOut(formatDiff(output) + '\n')
      }
    })
}

// Commander doesn't dispatch USAGE for positional-argument errors via
// exitOverride the same way it does for options — we surface these as
// UsageError from inside the action when parse succeeds but the content
// is wrong. Missing `<a>` or `<b>` is caught by commander itself.

interface Diff {
  added: CloudNode[]
  removed: CloudNode[]
  changed: DiffChange[]
}

function computeDiff(a: ScanOutput, b: ScanOutput): Diff {
  const byIdA = new Map(a.nodes.map((n) => [n.id, n]))
  const byIdB = new Map(b.nodes.map((n) => [n.id, n]))

  const added: CloudNode[] = []
  const removed: CloudNode[] = []
  const changed: DiffChange[] = []

  for (const [id, node] of byIdB) {
    if (!byIdA.has(id)) {
      added.push(node)
      continue
    }
    const fields = fieldDiff(byIdA.get(id)!, node)
    if (fields.length > 0) {
      changed.push({ id, fields })
    }
  }

  for (const [id, node] of byIdA) {
    if (!byIdB.has(id)) removed.push(node)
  }

  // Stable sort by id for deterministic JSON output
  const byId = (x: { id: string }, y: { id: string }): number => x.id.localeCompare(y.id)
  return {
    added: added.sort(byId),
    removed: removed.sort(byId),
    changed: changed.sort(byId)
  }
}

// Compare the subset of CloudNode fields that CI consumers care about.
// Region + parentId are structural; status/label are operator-facing;
// metadata is flattened one level because nested JSON-stringify churn
// generates noisy diffs.
const DIRECT_KEYS: Array<keyof CloudNode> = ['type', 'label', 'status', 'region', 'parentId']

function fieldDiff(a: CloudNode, b: CloudNode): DiffChange['fields'] {
  const fields: DiffChange['fields'] = []

  for (const key of DIRECT_KEYS) {
    if (a[key] !== b[key]) {
      fields.push({ field: key, before: a[key], after: b[key] })
    }
  }

  const metaA = (a.metadata ?? {}) as Record<string, unknown>
  const metaB = (b.metadata ?? {}) as Record<string, unknown>
  const keys = new Set([...Object.keys(metaA), ...Object.keys(metaB)])
  for (const k of [...keys].sort()) {
    const before = metaA[k]
    const after = metaB[k]
    // Deep-equal via JSON.stringify — matches scanner.ts's existing semantics.
    // Values are AWS API responses: plain objects / primitives / arrays.
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      fields.push({ field: `metadata.${k}`, before: before ?? null, after: after ?? null })
    }
  }

  return fields
}

// Re-exported so the action can annotate parse failures if needed.
export { UsageError }
