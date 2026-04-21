// CLI exit codes — stable contract for CI consumers.
// OK=0: no findings / success
// FINDINGS=1: --fail-on gate tripped (risks) or drift found (--fail-on-drift)
// USAGE=2: invalid args, unknown command, missing file
// AUTH=3: credential / auth failure from scan
// RUNTIME=4: unexpected error

export const EXIT = {
  OK: 0,
  FINDINGS: 1,
  USAGE: 2,
  AUTH: 3,
  RUNTIME: 4
} as const

export type ExitCode = (typeof EXIT)[keyof typeof EXIT]
