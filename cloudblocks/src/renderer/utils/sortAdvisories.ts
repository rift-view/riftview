import type { Advisory } from '../types/cloud'

const SEVERITY_ORDER: Record<Advisory['severity'], number> = {
  critical: 0,
  warning:  1,
  info:     2,
}

/**
 * Returns a new array of advisories sorted by severity (critical first),
 * preserving insertion order within each severity tier (stable sort).
 */
export function sortAdvisories(advisories: Advisory[]): Advisory[] {
  return [...advisories].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  )
}
