// RENDERER-ONLY: Do not import from src/main/ or src/preload/.
// Scoped to tsconfig.web.json — import.meta.env is only available in renderer context.

export type FlagName =
  | 'COMMAND_BOARD'      // Phase 1: always-on (kept for flags.test.ts)
  | 'ACTION_RAIL'        // Phase 1: always-on (kept for ResourceNode.advisories.test.tsx)
  | 'EXECUTION_ENGINE'   // Phase 2: always-on (kept for Inspector.remediate.test.tsx)

const ENV_PREFIX = 'VITE_FLAG_'

/**
 * Reads a feature flag from Vite compile-time env vars.
 * Reads at call time (not cached) — vi.stubEnv works correctly in tests.
 */
export function flag(name: FlagName): boolean {
  const key = `${ENV_PREFIX}${name}`
  return (import.meta.env as Record<string, string | undefined>)[key] === 'true'
}
