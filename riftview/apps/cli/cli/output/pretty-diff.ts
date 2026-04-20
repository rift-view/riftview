import type { DiffOutput } from './schema'
import { ANSI, colour, shouldColour } from './tty'

export interface PrettyDiffOptions {
  coloured?: boolean
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

export function formatDiff(output: DiffOutput, opts: PrettyDiffOptions = {}): string {
  const coloured = opts.coloured ?? shouldColour()
  const lines: string[] = []

  lines.push(colour(ANSI.bold, `riftview diff — ${output.a} → ${output.b}`, coloured))
  lines.push(
    colour(
      ANSI.dim,
      `${output.added.length} added · ${output.removed.length} removed · ${output.changed.length} changed`,
      coloured
    )
  )
  lines.push('')

  if (output.added.length === 0 && output.removed.length === 0 && output.changed.length === 0) {
    lines.push(colour(ANSI.green, '  ✓ no changes', coloured))
    return lines.join('\n')
  }

  if (output.added.length > 0) {
    lines.push(colour(ANSI.bold, `Added (${output.added.length})`, coloured))
    for (const n of output.added) {
      lines.push(
        `  ${colour(ANSI.green, '+', coloured)} ${n.type} ${n.id} ${colour(ANSI.dim, `(${n.label})`, coloured)}`
      )
    }
    lines.push('')
  }

  if (output.removed.length > 0) {
    lines.push(colour(ANSI.bold, `Removed (${output.removed.length})`, coloured))
    for (const n of output.removed) {
      lines.push(
        `  ${colour(ANSI.red, '-', coloured)} ${n.type} ${n.id} ${colour(ANSI.dim, `(${n.label})`, coloured)}`
      )
    }
    lines.push('')
  }

  if (output.changed.length > 0) {
    lines.push(colour(ANSI.bold, `Changed (${output.changed.length})`, coloured))
    for (const c of output.changed) {
      lines.push(`  ${colour(ANSI.yellow, '~', coloured)} ${c.id}`)
      for (const f of c.fields) {
        const before = colour(ANSI.red, formatValue(f.before), coloured)
        const after = colour(ANSI.green, formatValue(f.after), coloured)
        lines.push(`      ${colour(ANSI.dim, f.field, coloured)}: ${before} → ${after}`)
      }
    }
  }

  return lines.join('\n')
}
