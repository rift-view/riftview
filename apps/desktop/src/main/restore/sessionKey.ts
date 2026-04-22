/**
 * Main-process session key — 32 random bytes minted once at module load.
 * Never serialised, never sent across IPC. Lives only in main-process RAM.
 * Used to HMAC-sign plan projections so the renderer cannot forge them.
 *
 * Spec: docs/superpowers/specs/2026-04-20-snapshot-export-security.md §3c-T3 (amendment a)
 */

import { randomBytes } from 'node:crypto'

const _key: Buffer = randomBytes(32)

export function getMainSessionKey(): Buffer {
  return _key
}
