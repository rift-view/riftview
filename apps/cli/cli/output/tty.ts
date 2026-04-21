// Minimal ANSI helper. No external colour library — this stays small
// enough to audit and keeps the published bundle lean.

export const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  grey: '\x1b[90m'
} as const

export type AnsiCode = (typeof ANSI)[keyof typeof ANSI]

/** Honour NO_COLOR (https://no-color.org) and non-TTY stdout. */
export function shouldColour(stream: NodeJS.WriteStream = process.stdout): boolean {
  if (process.env.NO_COLOR) return false
  return Boolean(stream.isTTY)
}

export function colour(code: AnsiCode, text: string, enabled: boolean): string {
  return enabled ? `${code}${text}${ANSI.reset}` : text
}
