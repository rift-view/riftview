import { EXIT } from './exitCodes'

// commander's built-in errors map to our CI-stable exit code table.
const COMMANDER_USAGE_CODES = new Set([
  'commander.unknownCommand',
  'commander.unknownOption',
  'commander.missingArgument',
  'commander.missingMandatoryOptionValue',
  'commander.invalidArgument',
  'commander.invalidOptionArgument',
  'commander.excessArguments',
  'commander.help'
])

export function mapCommanderExit(err: unknown): number {
  if (!err || typeof err !== 'object') return EXIT.RUNTIME
  const e = err as { exitCode?: number; code?: string; message?: string }

  // Help & --version successful displays: exit 0
  if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version') {
    return EXIT.OK
  }

  if (e.code && COMMANDER_USAGE_CODES.has(e.code)) {
    return EXIT.USAGE
  }

  if (typeof e.exitCode === 'number') {
    // Our own error classes set 0–4 directly.
    if (e.exitCode >= 0 && e.exitCode <= 4) return e.exitCode
    // commander.CommanderError defaults to 1 for unhandled cases → treat as USAGE.
    return EXIT.USAGE
  }

  return EXIT.RUNTIME
}
