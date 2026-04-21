import { createHash } from 'node:crypto'
import { canonicalize } from './canonical'
import type { ScanPayload } from './types'

export function contentHash(payload: ScanPayload): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex')
}
