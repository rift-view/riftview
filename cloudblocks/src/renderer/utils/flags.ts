// RENDERER-ONLY: Do not import from src/main/ or src/preload/.
// Scoped to tsconfig.web.json — import.meta.env is only available in renderer context.

export type FlagName =
  | 'COMMAND_BOARD'      // Phase 1: relationship-first layout engine
  | 'STATUS_LANGUAGE'    // Phase 1: live health visual texture on nodes
  | 'ACTION_RAIL'        // Phase 1: node hover inline action surface
  | 'EXECUTION_ENGINE'   // Phase 2: bulk ops + action chains
  | 'OP_INTELLIGENCE'    // Phase 3: command palette + CloudWatch log tail

const ENV_PREFIX = 'VITE_FLAG_'

/**
 * Reads a feature flag from Vite compile-time env vars.
 * Reads at call time (not cached) — vi.stubEnv works correctly in tests.
 */
export function flag(name: FlagName): boolean {
  const key = `${ENV_PREFIX}${name}`
  return (import.meta.env as Record<string, string | undefined>)[key] === 'true'
}
