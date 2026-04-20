import { EXIT, type ExitCode } from './exitCodes'

export class UsageError extends Error {
  readonly exitCode = EXIT.USAGE
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

// `risks --fail-on` and `drift --fail-on-drift` surface threshold hits as a
// non-error exit 1 — CI pipelines read this as "findings present, gate tripped".
export class FindingsError extends Error {
  readonly exitCode = EXIT.FINDINGS
  constructor(message: string) {
    super(message)
    this.name = 'FindingsError'
  }
}

export class AuthError extends Error {
  readonly exitCode = EXIT.AUTH
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class RuntimeError extends Error {
  readonly exitCode = EXIT.RUNTIME
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeError'
  }
}

export function errorToExitCode(err: unknown): ExitCode {
  if (err instanceof FindingsError) return err.exitCode
  if (err instanceof UsageError) return err.exitCode
  if (err instanceof AuthError) return err.exitCode
  if (err instanceof RuntimeError) return err.exitCode
  return EXIT.RUNTIME
}
