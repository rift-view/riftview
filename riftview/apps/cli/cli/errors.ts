import { EXIT, type ExitCode } from './exitCodes'

export class UsageError extends Error {
  readonly exitCode = EXIT.USAGE
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
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
  if (err instanceof UsageError) return err.exitCode
  if (err instanceof AuthError) return err.exitCode
  if (err instanceof RuntimeError) return err.exitCode
  return EXIT.RUNTIME
}
