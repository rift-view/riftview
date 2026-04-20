// `riftview drift` — compare live AWS state against a Terraform tfstate file.
// Surface matched / unmanaged / missing resources. `--fail-on-drift` gates CI.
//
// The scan runner is injected (tests stub it). parseTfState lives in
// @riftview/shared; readFile IO is injectable via `readState` for unit tests.
import { readFileSync } from 'node:fs'
import type { Command } from 'commander'
import {
  classifyScanError,
  compareDrift,
  getDefaultRegion,
  parseTfState,
  type CloudNode
} from '@riftview/shared'
import { AuthError, FindingsError, RuntimeError, UsageError } from '../errors'
import { toJson } from '../output/json'
import { formatDrift } from '../output/pretty-drift'
import type { DriftOutput } from '../output/schema'
import { SCHEMA_VERSION } from '../output/schema'
import type { ScanRunner, ScanRunnerResult } from './scan'

export interface DriftDeps {
  runner?: ScanRunner
  resolveDefaultRegion?: (profile: string) => string
  /** Override tfstate read — tests stub this with fixture contents. */
  readState?: (path: string) => string
}

interface DriftFlags {
  state?: string
  profile?: string
  region?: string
  endpoint?: string
  failOnDrift?: boolean
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

function readStateFile(path: string, reader: (p: string) => string): string {
  try {
    return reader(path)
  } catch (err) {
    throw new UsageError(`Cannot read tfstate at ${path}: ${(err as Error).message ?? String(err)}`)
  }
}

export function registerDrift(program: Command, deps: DriftDeps = {}): void {
  const runner = deps.runner
  const resolveDefault = deps.resolveDefaultRegion ?? getDefaultRegion
  const readState = deps.readState ?? ((p) => readFileSync(p, 'utf8'))

  program
    .command('drift')
    .description(
      'compare live AWS state against a Terraform tfstate file (CI-friendly via --fail-on-drift)'
    )
    // Required but validated manually — commander's .requiredOption() calls
    // process.exit even when exitOverride() is set on the root program.
    .option('--state <path>', 'path to terraform.tfstate (or tfstate JSON)')
    .option('--profile <name>', 'AWS profile to scan', 'default')
    .option('--region <list>', 'comma-separated region list (default: profile default region)')
    .option('--endpoint <url>', 'AWS endpoint override (e.g. http://localhost:4566 for LocalStack)')
    .option('--fail-on-drift', 'exit 1 if any unmanaged or missing resources are found', false)
    .action(async (flags: DriftFlags) => {
      if (!flags.state) {
        // `requiredOption` normally catches this before the action — defensive only.
        throw new UsageError('`--state` is required')
      }

      const raw = readStateFile(flags.state, readState)
      let imported: CloudNode[]
      try {
        imported = parseTfState(raw)
      } catch (err) {
        throw new UsageError(
          `Failed to parse tfstate at ${flags.state}: ${(err as Error).message ?? String(err)}`
        )
      }

      const liveNodes = await resolveLiveNodes(flags, { runner, resolveDefault })
      const result = compareDrift(liveNodes, imported)

      const liveById = new Map(liveNodes.map((n) => [n.id, n]))
      const importedById = new Map(imported.map((n) => [n.id, n]))

      const unmanaged = result.unmanaged
        .map((id) => liveById.get(id))
        .filter((n): n is CloudNode => n !== undefined)
      const missing = result.missing
        .map((id) => importedById.get(id))
        .filter((n): n is CloudNode => n !== undefined)

      const driftCount = unmanaged.length + missing.length
      const exitCode = flags.failOnDrift && driftCount > 0 ? 1 : 0

      const output: DriftOutput = {
        schemaVersion: SCHEMA_VERSION,
        command: 'drift',
        statePath: flags.state,
        matched: result.matched,
        unmanaged,
        missing,
        counts: {
          matched: result.matched.length,
          unmanaged: unmanaged.length,
          missing: missing.length
        },
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
        cfg.writeOut(formatDrift(output) + '\n')
      }

      if (exitCode === 1) {
        throw new FindingsError(`${driftCount} drift finding(s) detected`)
      }
    })
}

async function resolveLiveNodes(
  flags: DriftFlags,
  ctx: { runner?: ScanRunner; resolveDefault: (profile: string) => string }
): Promise<CloudNode[]> {
  if (!ctx.runner) {
    throw new RuntimeError('drift: no scan runner wired (bin.ts)')
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
