// Commander chosen (v12) — small, typed, zero-dep. Supports subcommands,
// negation flags, and exitOverride/configureOutput for CI-friendly testing.
import { Command, Option } from 'commander'
import { registerDrift, type DriftDeps } from './commands/drift'
import { registerRisks, type RisksDeps } from './commands/risks'
import { registerScan, type ScanDeps } from './commands/scan'
import { registerVersion } from './commands/version'
import { PKG_VERSION } from './version-constant'

export interface BuildProgramOptions {
  scan?: ScanDeps
  risks?: RisksDeps
  drift?: DriftDeps
}

export function buildProgram(opts: BuildProgramOptions = {}): Command {
  const program = new Command()
  program
    .name('riftview')
    .description('RiftView CLI — CI-first AWS scan, risks, drift, diff')
    .version(PKG_VERSION, '-v, --version', 'print version and exit')
    .addOption(
      new Option('--output <format>', 'output format').choices(['pretty', 'json']).default('pretty')
    )
    .allowExcessArguments(false)

  registerVersion(program)
  registerScan(program, opts.scan)
  registerRisks(program, opts.risks)
  registerDrift(program, opts.drift)

  // Subcommands coming in later tasks: diff.

  return program
}
