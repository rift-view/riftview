// RENDERER-ONLY: Do not import from src/main/ or src/preload/.
// Scoped to tsconfig.web.json — import.meta.env is only available in renderer context.

/**
 * Demo mode — masks account IDs, ARNs, and other sensitive identifiers in
 * the UI so screen recordings and screenshots don't leak real account data.
 *
 * Enable via env: `VITE_DEMO_MODE=1` (or `true`) at build/run time.
 *
 * Usage:
 *   redact('arn:aws:iam::123456789012:user/julius')
 *     → 'arn:aws:iam::************:user/julius'  (when on)
 *     → unchanged                                 (when off)
 */

export function isDemoMode(): boolean {
  const raw = (import.meta.env as Record<string, string | undefined>).VITE_DEMO_MODE
  return raw === '1' || raw === 'true'
}

const ACCOUNT_ID_RE = /\b\d{12}\b/g
const ACCESS_KEY_RE = /\bAKIA[0-9A-Z]{16}\b/g
const SESSION_KEY_RE = /\bASIA[0-9A-Z]{16}\b/g
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
// Matches hex blobs that look like raw credentials (16+ hex chars)
const CREDENTIAL_BLOB_RE = /\b[a-fA-F0-9]{32,}\b/g

/**
 * Redact sensitive identifiers from a string. Safe to call unconditionally —
 * no-op when demo mode is off, so callsites don't need to branch.
 */
export function redact(input: string): string {
  if (!isDemoMode()) return input
  return input
    .replace(ACCOUNT_ID_RE, '************')
    .replace(ACCESS_KEY_RE, 'AKIA****************')
    .replace(SESSION_KEY_RE, 'ASIA****************')
    .replace(IP_RE, '***.***.***.***')
    .replace(CREDENTIAL_BLOB_RE, '[redacted]')
}

/**
 * Redact but preserve a visible label/suffix for navigation. Used when the
 * identifier is also a lookup key (e.g. a node ID) — keeps the last 4 chars
 * so different resources still look different.
 */
export function redactKeepSuffix(input: string, tailLen = 4): string {
  if (!isDemoMode()) return input
  if (input.length <= tailLen) return '*'.repeat(input.length)
  return '*'.repeat(input.length - tailLen) + input.slice(-tailLen)
}
