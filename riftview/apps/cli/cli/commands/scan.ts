// `riftview scan` — run a full cloud scan, emit ScanOutput, optionally snapshot.
//
// The command is fully dependency-injected via `ScanDeps` so tests can stub the
// scanner without spinning up AWS SDK clients. The default wiring in
// `bin.ts` supplies a real AWS-backed runner via `scan-runtime.ts`.
import type { Command } from 'commander'
import {
  analyzeGraph,
  analyzeNode,
  classifyScanError,
  getDefaultRegion,
  sortAdvisories,
  type Advisory,
  type CloudNode,
  type ScanError
} from '@riftview/shared'
import { AuthError, RuntimeError, UsageError } from '../errors'
import { toJson } from '../output/json'
import { formatScan } from '../output/pretty'
import type { OutputIntegrationEdge, ScanOutput } from '../output/schema'
import { SCHEMA_VERSION } from '../output/schema'
import { writeSnapshot } from '../snapshot'

export interface ScanRunnerInput {
  profile: string
  regions: string[]
  endpoint?: string
}

export interface ScanRunnerResult {
  nodes: CloudNode[]
  errors: ScanError[]
  durationMs: number
}

export type ScanRunner = (input: ScanRunnerInput) => Promise<ScanRunnerResult>

export interface ScanDeps {
  runner?: ScanRunner
  now?: () => Date
  /** Override default-region lookup (tests stub this). */
  resolveDefaultRegion?: (profile: string) => string
}

interface ScanFlags {
  profile?: string
  region?: string
  snapshot?: string
  endpoint?: string
}

function defaultRunnerUnwired(): never {
  throw new RuntimeError(
    'riftview scan: no scan runner wired. CLI was invoked without the default AWS provider — see bin.ts.'
  )
}

function flattenEdges(nodes: CloudNode[]): OutputIntegrationEdge[] {
  const edges: OutputIntegrationEdge[] = []
  for (const node of nodes) {
    if (!node.integrations) continue
    for (const i of node.integrations) {
      edges.push({ source: node.id, target: i.targetId, edgeType: i.edgeType })
    }
  }
  return edges
}

function computeTopRisks(nodes: CloudNode[]): Advisory[] {
  const all: Advisory[] = []
  for (const node of nodes) {
    all.push(...analyzeNode(node))
  }
  all.push(...analyzeGraph(nodes))
  return sortAdvisories(all).slice(0, 3)
}

function parseRegions(region: string | undefined, fallback: () => string): string[] {
  if (!region) return [fallback()]
  const list = region
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
  if (list.length === 0) {
    throw new UsageError('`--region` requires at least one region name')
  }
  return list
}

// Converts any thrown error into the CLI's exit-code taxonomy. AWS auth
// failures surface as `AuthError` (exit 3); everything else is RUNTIME (4).
function mapScanError(err: unknown): never {
  const detail = classifyScanError(err)
  if (detail.kind === 'credentials-expired' || detail.kind === 'credentials-invalid') {
    throw new AuthError(detail.message)
  }
  if (detail.kind === 'permission') {
    throw new AuthError(detail.message)
  }
  throw new RuntimeError(detail.message)
}

export function registerScan(program: Command, deps: ScanDeps = {}): void {
  const runner = deps.runner ?? (defaultRunnerUnwired as unknown as ScanRunner)
  const now = deps.now ?? (() => new Date())
  const resolveDefault = deps.resolveDefaultRegion ?? getDefaultRegion

  program
    .command('scan')
    .description('run a full scan of the current AWS account and print a summary')
    .option('--profile <name>', 'AWS profile to scan', 'default')
    .option('--region <list>', 'comma-separated region list (default: profile default region)')
    .option('--snapshot <path>', 'write full ScanOutput JSON to <path> for later diff/risks')
    .option('--endpoint <url>', 'AWS endpoint override (e.g. http://localhost:4566 for LocalStack)')
    .action(async (flags: ScanFlags) => {
      const profile = flags.profile ?? 'default'
      const regions = parseRegions(flags.region, () => resolveDefault(profile))
      const endpoint = flags.endpoint

      let result: ScanRunnerResult
      try {
        result = await runner({ profile, regions, endpoint })
      } catch (err) {
        mapScanError(err)
      }

      const output: ScanOutput = {
        schemaVersion: SCHEMA_VERSION,
        command: 'scan',
        profile,
        regions,
        ...(endpoint ? { endpoint } : {}),
        timestamp: now().toISOString(),
        durationMs: Math.round(result.durationMs),
        nodes: result.nodes,
        edges: flattenEdges(result.nodes),
        scanErrors: result.errors,
        topRisks: computeTopRisks(result.nodes)
      }

      if (flags.snapshot) {
        try {
          writeSnapshot(flags.snapshot, output)
        } catch (err) {
          throw new UsageError(
            `Failed to write snapshot to ${flags.snapshot}: ${(err as Error).message ?? String(err)}`
          )
        }
      }

      // commander's configureOutput is the only public hook for routing writes;
      // we reach in structurally so tests can capture output.
      const cfg = (
        program as unknown as {
          _outputConfiguration: { writeOut: (s: string) => void }
        }
      )._outputConfiguration

      const format = ((program.opts().output as string) ?? 'pretty') as 'pretty' | 'json'
      if (format === 'json') {
        cfg.writeOut(toJson(output) + '\n')
      } else {
        cfg.writeOut(formatScan(output) + '\n')
      }
    })
}
