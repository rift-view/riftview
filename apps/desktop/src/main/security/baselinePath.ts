import path from 'path'

/**
 * Resolve the on-disk path of a drift baseline (RIFT-146). `profileName` and
 * `region` arrive from the renderer over IPC and used to be interpolated into
 * the filename verbatim, so `../../x` escaped `userData/baselines`. Same guard
 * as the RIFT-128 `historyFilePath` in aws/scanner.ts:
 *
 *   1. every character outside [A-Za-z0-9_-] becomes `_` (so `..`, `/`, `\`
 *      and `:` can never form a path segment);
 *   2. the filename is resolved under `baselinesRoot`;
 *   3. the resolved path must still start with `baselinesRoot + path.sep`.
 *
 * Returns null for an empty or non-string input, or if step 3 fails.
 */
export function resolveBaselinePath(
  baselinesRoot: string,
  profileName: unknown,
  region: unknown
): string | null {
  const profile = sanitizeSegment(profileName)
  const reg = sanitizeSegment(region)
  if (!profile || !reg) return null

  const root = path.resolve(baselinesRoot)
  const resolved = path.resolve(root, `${profile}-${reg}.json`)
  if (!resolved.startsWith(root + path.sep)) return null
  return resolved
}

function sanitizeSegment(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, '_')
  return sanitized.length > 0 ? sanitized : null
}
