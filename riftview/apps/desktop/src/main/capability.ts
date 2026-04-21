/**
 * Main-process capability gates.
 *
 * isDemoMode() is the single source of truth the main process consults before
 * registering any destructive or credential-adjacent handler. The security spec
 * requires destructive flows to be structurally *absent* under demo mode — the
 * ipcMain.handle() call must not run, so the renderer sees "No handler
 * registered" rather than a denial message.
 *
 * The env var is deliberately main-only (RIFTVIEW_DEMO_MODE, not VITE_*). The
 * renderer's VITE_DEMO_MODE stays for UI hiding; the main's flag is what the
 * restore IPC channel checks.
 */

const DEMO_MODE_ENV = 'RIFTVIEW_DEMO_MODE'
const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[DEMO_MODE_ENV]
  if (!raw) return false
  return TRUTHY.has(raw.toLowerCase().trim())
}

export const DEMO_MODE_ENV_VAR = DEMO_MODE_ENV
