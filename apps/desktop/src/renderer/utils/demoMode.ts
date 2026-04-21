// RENDERER-ONLY: Do not import from src/main/ or src/preload/.
// Scoped to tsconfig.web.json.

/**
 * Demo mode — masks account IDs, ARNs, and other sensitive identifiers in
 * the UI so screen recordings and screenshots don't leak real account data.
 *
 * Enable via env: `RIFTVIEW_DEMO_MODE=1` at main-process launch time. The
 * preload captures this into `window.riftview.isDemoMode` at load, so the
 * same bundle can boot with or without demo mode (e.g. Playwright E2E).
 *
 * Usage:
 *   redact('arn:aws:iam::123456789012:user/julius')
 *     → 'arn:aws:iam::************:user/julius'  (when on)
 *     → unchanged                                 (when off)
 */

export function isDemoMode(): boolean {
  // Read from the preload bridge (runtime-settable via RIFTVIEW_DEMO_MODE
  // env at main-process launch). Previously read Vite's build-time
  // VITE_DEMO_MODE, which couldn't be toggled after build.
  //
  // window.riftview is always present in the Electron renderer. The
  // null-safe chain guards unit tests that don't mock the bridge.
  return window.riftview?.isDemoMode ?? false
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
