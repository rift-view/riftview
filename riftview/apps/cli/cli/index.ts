// Commander chosen (v12) — small, typed, zero-dep. Supports subcommands,
// negation flags, and exitOverride/configureOutput for CI-friendly testing.
import { Command, Option } from 'commander'
import { registerVersion } from './commands/version'
import { PKG_VERSION } from './version-constant'

export function buildProgram(): Command {
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

  // Subcommands coming in later tasks: scan, risks, drift, diff.

  return program
}
