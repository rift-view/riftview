import { describe, it, expect } from 'vitest'
import { NODE_TYPES } from '../cloud'

/**
 * RIFT-80 — NodeType namespace contract.
 *
 * Every NodeType union member must either:
 *   - match `^[a-z]+:[a-z0-9-]+$` (provider-prefixed form, e.g. `aws:ec2`,
 *     `hetzner:server`, `vercel:project`), OR
 *   - equal `'unknown'` (the cross-provider sentinel for unmapped resources).
 *
 * This guard prevents un-namespaced NodeTypes from sneaking back in once
 * the migration is done. Adding a bare AWS literal like `'lambda'` would
 * fail this test loudly.
 */

const NAMESPACED_PATTERN = /^[a-z]+:[a-z0-9-]+$/

describe('NodeType namespace contract (RIFT-80)', () => {
  it('every member matches `provider:kind` or equals `unknown`', () => {
    for (const nodeType of NODE_TYPES) {
      const ok = nodeType === 'unknown' || NAMESPACED_PATTERN.test(nodeType)
      expect(ok, `NodeType "${nodeType}" violates namespace convention`).toBe(true)
    }
  })

  it('AWS namespace covers the expected 31 resource kinds', () => {
    const awsTypes = NODE_TYPES.filter((t) => t.startsWith('aws:'))
    expect(awsTypes).toHaveLength(31)
  })

  it('only one un-namespaced sentinel exists (`unknown`)', () => {
    const unNamespaced = NODE_TYPES.filter((t) => !NAMESPACED_PATTERN.test(t))
    expect(unNamespaced).toEqual(['unknown'])
  })

  it('NODE_TYPES has no duplicates', () => {
    expect(new Set(NODE_TYPES).size).toBe(NODE_TYPES.length)
  })
})
