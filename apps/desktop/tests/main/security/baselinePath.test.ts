import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveBaselinePath } from '../../../src/main/security/baselinePath'

const ROOT = path.resolve(path.sep, 'userData', 'baselines')

function isInside(root: string, file: string | null): boolean {
  if (file === null) return false
  const rel = path.relative(root, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

describe('resolveBaselinePath (RIFT-146)', () => {
  it('round-trips a normal profile and region', () => {
    expect(resolveBaselinePath(ROOT, 'default', 'us-east-1')).toBe(
      path.join(ROOT, 'default-us-east-1.json')
    )
    expect(resolveBaselinePath(ROOT, 'prod_admin', 'eu-west-2')).toBe(
      path.join(ROOT, 'prod_admin-eu-west-2.json')
    )
  })

  it('keeps a traversal profileName inside the baselines directory', () => {
    const resolved = resolveBaselinePath(ROOT, '../../../../x', 'us-east-1')
    expect(resolved).toBe(path.join(ROOT, '____________x-us-east-1.json'))
    expect(resolved!.startsWith(ROOT + path.sep)).toBe(true)
    expect(isInside(ROOT, resolved)).toBe(true)
  })

  it.each([
    ['absolute path', '/etc/passwd', 'us-east-1'],
    ['windows drive + backslashes', 'C:\\Windows\\system32', 'us-east-1'],
    ['traversal in region', 'default', '../../escape'],
    ['null byte', 'default\0evil', 'us-east-1'],
    ['dots only', '..', '..'],
    ['unicode', 'prófile', 'région'],
    ['whitespace and shell metacharacters', 'my profile; rm -rf ~', 'us east 1']
  ])('never escapes for %s', (_label, profile, region) => {
    const resolved = resolveBaselinePath(ROOT, profile, region)
    expect(resolved).not.toBeNull()
    expect(isInside(ROOT, resolved)).toBe(true)
    expect(path.dirname(resolved!)).toBe(ROOT)
    expect(path.basename(resolved!)).toMatch(/^[A-Za-z0-9_-]+\.json$/)
  })

  it('rejects empty or non-string inputs', () => {
    expect(resolveBaselinePath(ROOT, '', 'us-east-1')).toBeNull()
    expect(resolveBaselinePath(ROOT, 'default', '')).toBeNull()
    expect(resolveBaselinePath(ROOT, undefined, 'us-east-1')).toBeNull()
    expect(resolveBaselinePath(ROOT, 'default', null)).toBeNull()
    expect(resolveBaselinePath(ROOT, 42, 'us-east-1')).toBeNull()
    expect(resolveBaselinePath(ROOT, ['default'], 'us-east-1')).toBeNull()
  })
})
