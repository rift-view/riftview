import type { Advisory } from '@riftview/shared'
import type { RisksOutput } from './schema'
import { ANSI, colour, shouldColour } from './tty'

function severityIcon(severity: Advisory['severity'], coloured: boolean): string {
  const glyph = severity === 'critical' ? '●' : severity === 'warning' ? '▲' : '•'
  const code = severity === 'critical' ? ANSI.red : severity === 'warning' ? ANSI.yellow : ANSI.dim
  return colour(code, glyph, coloured)
}

export interface PrettyRisksOptions {
  coloured?: boolean
}

export function formatRisks(output: RisksOutput, opts: PrettyRisksOptions = {}): string {
  const coloured = opts.coloured ?? shouldColour()
  const lines: string[] = []

  const sourceLabel =
    output.source === 'snapshot' && output.snapshotPath
      ? `snapshot ${output.snapshotPath}`
      : 'fresh scan'
  lines.push(colour(ANSI.bold, `riftview risks — ${sourceLabel}`, coloured))
  lines.push(
    colour(
      ANSI.dim,
      `${output.counts.critical} critical · ${output.counts.warning} warning · ${output.counts.info} info`,
      coloured
    )
  )
  if (output.failOn) {
    lines.push(colour(ANSI.dim, `gate: --fail-on ${output.failOn}`, coloured))
  }
  lines.push('')

  if (output.advisories.length === 0) {
    lines.push(colour(ANSI.dim, '  (no findings)', coloured))
    return lines.join('\n')
  }

  for (const f of output.advisories) {
    const icon = severityIcon(f.severity, coloured)
    const ruleId = colour(ANSI.cyan, f.ruleId, coloured)
    const nodeId = colour(ANSI.dim, `(${f.nodeId})`, coloured)
    lines.push(`  ${icon} ${ruleId} — ${f.title} ${nodeId}`)
  }

  return lines.join('\n')
}
