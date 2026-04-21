/**
 * Main-process capability gates.
 *
 * isDemoMode() is the single source of truth the main process consults before
 * registering any destructive or credential-adjacent handler. The security spec
 * requires destructive flows to be structurally *absent* under demo mode — the
 * ipcMain.handle() call must not run, so the renderer sees "No handler
 * registered" rather than a denial message.
 *
 * The env var is RIFTVIEW_DEMO_MODE (not VITE_*). The preload mirrors this
 * same env onto window.riftview.isDemoMode for renderer UI hiding, so a single
 * env var drives both layers. Main's flag is what destructive IPC channels
 * check — the renderer bridge value is advisory/UI-only.
 */

const DEMO_MODE_ENV = 'RIFTVIEW_DEMO_MODE'
const TRUTHY = new Set(['1', 'true', 'yes', 'on'])

export function isDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[DEMO_MODE_ENV]
  if (!raw) return false
  return TRUTHY.has(raw.toLowerCase().trim())
}

export const DEMO_MODE_ENV_VAR = DEMO_MODE_ENV
