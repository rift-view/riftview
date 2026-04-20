// Deterministic JSON serialisation. Two-space indent matches the snapshot
// format so `scan --snapshot`, `scan --output json`, and `diff` all read
// byte-identical payloads.

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
