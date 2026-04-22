/**
 * Runtime allowlist check for .meta.json writes.
 *
 * Plaintext .meta.json sidecars must never contain resource identifiers, ARNs,
 * or account IDs. This check runs at write time (not only at lint time) so it
 * cannot be bypassed by skipping the linter.
 *
 * Allowed top-level keys: id, createdAt, profile, region, versionCount, schemaVersion
 * Rejected value patterns: ARNs, AKIA keys, 12-digit account IDs, instance IDs, VPC IDs
 *
 * Spec: §6.1 runtime enforcement, RIF-20 sign-off amendment (b) 2026-04-21
 */

const ALLOWED_KEYS = new Set<string>([
  'id',
  'createdAt',
  'profile',
  'region',
  'versionCount',
  'schemaVersion'
])

const SENSITIVE_PATTERNS: RegExp[] = [
  /arn:aws:/,
  /AKIA[0-9A-Z]{16}/,
  /\b\d{12}\b/,
  /i-[0-9a-f]{8,17}/,
  /vpc-[0-9a-f]{8,17}/
]

export class MetaAllowlistViolation extends Error {
  constructor(public readonly reason: string) {
    super(`meta.json allowlist violation: ${reason}`)
    this.name = 'MetaAllowlistViolation'
  }
}

/**
 * Validate a meta.json object before writing to disk.
 * Throws MetaAllowlistViolation if any key or value is disallowed.
 */
export function validateMetaJson(meta: Record<string, unknown>): void {
  for (const key of Object.keys(meta)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new MetaAllowlistViolation(`key '${key}' not in allowlist`)
    }
  }
  const serialised = JSON.stringify(meta)
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(serialised)) {
      throw new MetaAllowlistViolation(`value matches sensitive pattern ${pattern.source}`)
    }
  }
}
