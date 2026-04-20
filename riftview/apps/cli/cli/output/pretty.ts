import type { Advisory } from '@riftview/shared'
import type { ScanOutput } from './schema'
import { ANSI, colour, shouldColour } from './tty'

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const

function severityIcon(severity: Advisory['severity'], coloured: boolean): string {
  const glyph = severity === 'critical' ? '●' : severity === 'warning' ? '▲' : '•'
  const code = severity === 'critical' ? ANSI.red : severity === 'warning' ? ANSI.yellow : ANSI.dim
  return colour(code, glyph, coloured)
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export interface PrettyScanOptions {
  /** Override colour detection — tests set this explicitly. */
  coloured?: boolean
}

export function formatScan(result: ScanOutput, opts: PrettyScanOptions = {}): string {
  const coloured = opts.coloured ?? shouldColour()
  const lines: string[] = []

  const header = `riftview scan — ${result.profile} / ${result.regions.join(',')}`
  lines.push(colour(ANSI.bold, header, coloured))
  lines.push(
    colour(
      ANSI.dim,
      `${formatDuration(result.durationMs)} · ${result.nodes.length} nodes · ${result.edges.length} edges`,
      coloured
    )
  )
  lines.push('')

  // Resource breakdown: grouped by type, sorted descending by count.
  const byType = new Map<string, number>()
  for (const node of result.nodes) {
    byType.set(node.type, (byType.get(node.type) ?? 0) + 1)
  }
  const sorted = [...byType.entries()].sort(([, a], [, b]) => b - a)
  if (sorted.length === 0) {
    lines.push(colour(ANSI.dim, '  (no resources)', coloured))
  } else {
    lines.push(colour(ANSI.bold, 'Resources', coloured))
    for (const [type, count] of sorted) {
      lines.push(`  ${type.padEnd(20)} ${count}`)
    }
  }
  lines.push('')

  if (result.scanErrors.length > 0) {
    lines.push(colour(ANSI.bold, `Scan errors (${result.scanErrors.length})`, coloured))
    for (const err of result.scanErrors) {
      lines.push(
        `  ${colour(ANSI.red, '!', coloured)} ${err.service} (${err.region}): ${err.message}`
      )
    }
    lines.push('')
  }

  if (result.topRisks.length > 0) {
    lines.push(colour(ANSI.bold, 'Top risks', coloured))
    const risks = [...result.topRisks].sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    )
    for (const risk of risks) {
      lines.push(`  ${severityIcon(risk.severity, coloured)} ${risk.title} — ${risk.nodeId}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
