// Palette — 8 colors distinguishable across all 5 app themes
const PALETTE = [
  '#4a9eff', // blue
  '#f0a050', // orange
  '#50c87a', // green
  '#c084fc', // purple
  '#f87171', // red
  '#34d399', // teal
  '#fbbf24', // amber
  '#a78bfa' // violet
]

// Stable first-seen assignment: once a region gets a color it keeps it
// for the lifetime of the module (i.e., the app session).
const assignments = new Map<string, string>()
let nextIndex = 0

export function getRegionColor(region: string, override?: string): string {
  if (override) return override
  if (!assignments.has(region)) {
    assignments.set(region, PALETTE[nextIndex % PALETTE.length])
    nextIndex++
  }
  return assignments.get(region)!
}

/**
 * Build a { region → color } map for the given active regions,
 * applying per-region overrides from settings.
 */
export function buildRegionColorMap(
  regions: string[],
  overrides: Record<string, string> = {}
): Record<string, string> {
  return Object.fromEntries(regions.map((r) => [r, getRegionColor(r, overrides[r])]))
}
