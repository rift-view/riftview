import { describe, it, expect } from 'vitest'
import { classifyScanError } from '../../../src/main/aws/classifyScanError'

describe('classifyScanError', () => {
  it('classifies expired SSO session as credentials-expired', () => {
    const d = classifyScanError(new Error('The SSO session associated with this profile has expired'))
    expect(d.kind).toBe('credentials-expired')
    expect(d.message).toMatch(/expired|re-auth/i)
  })

  it('classifies InvalidClientTokenId as credentials-invalid', () => {
    const d = classifyScanError(new Error('InvalidClientTokenId: The security token included in the request is invalid'))
    expect(d.kind).toBe('credentials-invalid')
  })

  it('classifies SignatureDoesNotMatch as credentials-invalid', () => {
    const d = classifyScanError(new Error('SignatureDoesNotMatch: The request signature we calculated does not match'))
    expect(d.kind).toBe('credentials-invalid')
  })

  it('classifies AccessDenied as permission', () => {
    const d = classifyScanError(new Error('AccessDenied: User: arn:aws:iam::x:user/y is not authorized'))
    expect(d.kind).toBe('permission')
  })

  it('classifies ThrottlingException as throttle', () => {
    const d = classifyScanError(new Error('ThrottlingException: Rate exceeded'))
    expect(d.kind).toBe('throttle')
  })

  it('classifies opt-in region error as region-disabled', () => {
    const d = classifyScanError(new Error('OptInRequired: The region me-south-1 is not enabled'))
    expect(d.kind).toBe('region-disabled')
  })

  it('classifies ENOTFOUND as network', () => {
    const d = classifyScanError(new Error('getaddrinfo ENOTFOUND ec2.us-east-1.amazonaws.com'))
    expect(d.kind).toBe('network')
  })

  it('classifies timeout as network', () => {
    const d = classifyScanError(new Error('Request timeout after 30000ms'))
    expect(d.kind).toBe('network')
  })

  it('falls back to unknown with raw message preserved', () => {
    const d = classifyScanError(new Error('Weird unexpected failure mode'))
    expect(d.kind).toBe('unknown')
    expect(d.raw).toBe('Weird unexpected failure mode')
    expect(d.message).toContain('Weird')
  })

  it('handles non-Error thrown values', () => {
    const d = classifyScanError('raw string thrown')
    expect(d.kind).toBe('unknown')
    expect(d.raw).toBe('raw string thrown')
  })
})
