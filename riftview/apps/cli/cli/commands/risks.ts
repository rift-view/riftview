// `riftview risks` — run analyzeNode + analyzeGraph over a scan (fresh or
// snapshotted), emit Findings with stable composite IDs, and optionally gate
// CI via --fail-on S1|S2|S3.
//
// Severity mapping (confirmed by product): S1=critical, S2=warning, S3=info.
// `--fail-on S2` fails when any critical OR warning is present.
import type { Command } from 'commander'
import {
  analyzeGraph,
  analyzeNode,
  classifyScanError,
  getDefaultRegion,
  sortAdvisories,
  type Advisory,
  type CloudNode
} from '@riftview/shared'
import { AuthError, FindingsError, RuntimeError, UsageError } from '../errors'
import { toJson } from '../output/json'
import { formatRisks } from '../output/pretty-risks'
import type { Finding, RisksOutput } from '../output/schema'
import { SCHEMA_VERSION } from '../output/schema'
import { readSnapshot } from '../snapshot'
import type { ScanRunner, ScanRunnerResult } from './scan'

export interface RisksDeps {
  runner?: ScanRunner
  resolveDefaultRegion?: (profile: string) => string
  /** Override snapshot reader — tests stub this. */
  readSnapshot?: (path: string) => ReturnType<typeof readSnapshot>
}

export type FailOn = 'S1' | 'S2' | 'S3'

interface RisksFlags {
  profile?: string
  region?: string
  endpoint?: string
  snapshot?: string
  /** Raw string from commander — validated in the action before use. */
  failOn?: string
}

const SEVERITY_THRESHOLD: Record<FailOn, Array<Advisory['severity']>> = {
  S1: ['critical'],
  S2: ['critical', 'warning'],
  S3: ['critical', 'warning', 'info']
}

function decorate(advisories: Advisory[]): Finding[] {
  return advisories.map((a) => ({ ...a, id: `${a.ruleId}:${a.nodeId}` }))
}

function computeCounts(findings: Finding[]): RisksOutput['counts'] {
  const counts = { critical: 0, warning: 0, info: 0 }
  for (const f of findings) counts[f.severity] += 1
  return counts
}

function gate(findings: Finding[], failOn: FailOn | undefined): number {
  if (!failOn) return 0
  const tripSeverities = SEVERITY_THRESHOLD[failOn]
  return findings.some((f) => tripSeverities.includes(f.severity)) ? 1 : 0
}

function mapScanError(err: unknown): never {
  const detail = classifyScanError(err)
  if (
    detail.kind === 'credentials-expired' ||
    detail.kind === 'credentials-invalid' ||
    detail.kind === 'permission'
  ) {
    throw new AuthError(detail.message)
  }
  throw new RuntimeError(detail.message)
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

function analyzeAll(nodes: CloudNode[]): Advisory[] {
  const out: Advisory[] = []
  for (const node of nodes) out.push(...analyzeNode(node))
  out.push(...analyzeGraph(nodes))
  return out
}

export function registerRisks(program: Command, deps: RisksDeps = {}): void {
  const runner = deps.runner
  const resolveDefault = deps.resolveDefaultRegion ?? getDefaultRegion
  const readSnap = deps.readSnapshot ?? readSnapshot

  program
    .command('risks')
    .description(
      'list severity-sorted risks from a fresh scan or a saved snapshot (CI-friendly via --fail-on)'
    )
    .option('--profile <name>', 'AWS profile to scan', 'default')
    .option('--region <list>', 'comma-separated region list (default: profile default region)')
    .option('--endpoint <url>', 'AWS endpoint override (e.g. http://localhost:4566 for LocalStack)')
    .option('--snapshot <path>', 'read nodes from a scan snapshot instead of hitting AWS')
    // Validated manually below — commander's .choices() calls process.exit
    // on subcommand options even when exitOverride() is set on the root.
    .option(
      '--fail-on <severity>',
      'exit 1 if any advisory at this severity or higher (S1=critical, S2=warning, S3=info)'
    )
    .action(async (flags: RisksFlags) => {
      const failOn = validateFailOn(flags.failOn)
      const nodes: CloudNode[] = await resolveNodes(flags, { runner, resolveDefault, readSnap })

      const findings = sortAdvisories(analyzeAll(nodes)) as Finding[]
      const decorated = decorate(findings)
      const counts = computeCounts(decorated)
      const exitCode = gate(decorated, failOn)

      const output: RisksOutput = {
        schemaVersion: SCHEMA_VERSION,
        command: 'risks',
        source: flags.snapshot ? 'snapshot' : 'scan',
        ...(flags.snapshot ? { snapshotPath: flags.snapshot } : {}),
        advisories: decorated,
        counts,
        ...(failOn ? { failOn } : {}),
        exitCode
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
        cfg.writeOut(formatRisks(output) + '\n')
      }

      if (exitCode === 1) {
        throw new FindingsError(`${decorated.length} finding(s) at or above ${failOn} severity`)
      }
    })
}

const VALID_FAIL_ON: readonly FailOn[] = ['S1', 'S2', 'S3']
function validateFailOn(value: string | undefined): FailOn | undefined {
  if (value === undefined) return undefined
  if ((VALID_FAIL_ON as readonly string[]).includes(value)) return value as FailOn
  throw new UsageError(`\`--fail-on\` expects one of ${VALID_FAIL_ON.join(', ')} (got "${value}")`)
}

// Shared internal resolver so the command body stays linear.
async function resolveNodes(
  flags: RisksFlags,
  ctx: {
    runner?: ScanRunner
    resolveDefault: (profile: string) => string
    readSnap: (path: string) => ReturnType<typeof readSnapshot>
  }
): Promise<CloudNode[]> {
  if (flags.snapshot) {
    return ctx.readSnap(flags.snapshot).nodes
  }
  if (!ctx.runner) {
    throw new RuntimeError('risks: no scan runner wired for fresh scan path (bin.ts)')
  }
  const profile = flags.profile ?? 'default'
  const regions = parseRegions(flags.region, () => ctx.resolveDefault(profile))
  let result: ScanRunnerResult
  try {
    result = await ctx.runner({ profile, regions, endpoint: flags.endpoint })
  } catch (err) {
    mapScanError(err)
  }
  return result.nodes
}
