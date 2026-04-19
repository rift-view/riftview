import { describe, it, expect } from 'vitest'
import { urlDecodePolicy } from '../../../../src/main/aws/iam/fetcher'

describe('urlDecodePolicy', () => {
  it('decodes percent-encoded policy string', () => {
    const encoded = '%7B%22Version%22%3A%222012-10-17%22%7D'
    expect(urlDecodePolicy(encoded)).toBe('{"Version":"2012-10-17"}')
  })

  it('returns plain string unchanged', () => {
    const plain = '{"Version":"2012-10-17"}'
    expect(urlDecodePolicy(plain)).toBe(plain)
  })

  it('handles malformed encoding gracefully (returns original)', () => {
    const malformed = '%invalid%encoding'
    expect(urlDecodePolicy(malformed)).toBe(malformed)
  })
})
