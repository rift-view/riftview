import type { DriftOutput } from './schema'
import { ANSI, colour, shouldColour } from './tty'

export interface PrettyDriftOptions {
  coloured?: boolean
}

export function formatDrift(output: DriftOutput, opts: PrettyDriftOptions = {}): string {
  const coloured = opts.coloured ?? shouldColour()
  const lines: string[] = []

  lines.push(colour(ANSI.bold, `riftview drift — ${output.statePath}`, coloured))
  lines.push(
    colour(
      ANSI.dim,
      `${output.counts.matched} matched · ${output.counts.unmanaged} unmanaged · ${output.counts.missing} missing`,
      coloured
    )
  )
  lines.push('')

  if (output.counts.unmanaged === 0 && output.counts.missing === 0) {
    lines.push(colour(ANSI.green, '  ✓ no drift detected', coloured))
    return lines.join('\n')
  }

  if (output.unmanaged.length > 0) {
    lines.push(colour(ANSI.bold, `Unmanaged (${output.unmanaged.length})`, coloured))
    lines.push(colour(ANSI.dim, '  live resources not present in tfstate:', coloured))
    for (const n of output.unmanaged) {
      lines.push(
        `  ${colour(ANSI.yellow, '+', coloured)} ${n.type} ${n.id}${
          n.label && n.label !== n.id ? ` (${n.label})` : ''
        }`
      )
    }
    lines.push('')
  }

  if (output.missing.length > 0) {
    lines.push(colour(ANSI.bold, `Missing (${output.missing.length})`, coloured))
    lines.push(colour(ANSI.dim, '  tfstate resources not found live:', coloured))
    for (const n of output.missing) {
      lines.push(
        `  ${colour(ANSI.red, '-', coloured)} ${n.type} ${n.id}${
          n.label && n.label !== n.id ? ` (${n.label})` : ''
        }`
      )
    }
  }

  return lines.join('\n')
}
