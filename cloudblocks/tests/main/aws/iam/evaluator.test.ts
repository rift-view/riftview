import { describe, it, expect } from 'vitest'
import { evaluatePolicy } from '../../../../src/main/aws/iam/evaluator'
import type { PolicyStatement } from '../../../../src/main/aws/iam/evaluator'

const allow = (
  action: string | string[],
  resource: string | string[],
  principal?: string | Record<string, string | string[]>
): PolicyStatement => ({
  Effect: 'Allow',
  Action: action,
  Resource: resource,
  ...(principal !== undefined ? { Principal: principal } : {}),
})

const deny = (action: string | string[], resource: string | string[]): PolicyStatement => ({
  Effect: 'Deny',
  Action: action,
  Resource: resource,
})

describe('evaluatePolicy', () => {
  // CRITICAL rules
  it('flags AdministratorAccess managed policy by name', () => {
    const findings = evaluatePolicy({ Statement: [allow('*', '*')] }, 'AdministratorAccess')
    expect(findings.some(f => f.severity === 'critical' && f.title.includes('AdministratorAccess'))).toBe(true)
  })

  it('flags wildcard action + wildcard resource (Action:* Resource:*)', () => {
    const findings = evaluatePolicy({ Statement: [allow('*', '*')] })
    expect(findings.some(f => f.severity === 'critical' && f.title.includes('Wildcard'))).toBe(true)
  })

  it('flags iam:* action as string', () => {
    const findings = evaluatePolicy({ Statement: [allow('iam:*', '*')] })
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })

  it('flags iam:* in array of actions', () => {
    const findings = evaluatePolicy({ Statement: [allow(['iam:*', 's3:GetObject'], '*')] })
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })

  // WARNING rules
  it('flags s3:* with wildcard resource', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:*', '*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('S3'))).toBe(true)
  })

  it('does NOT flag s3:* with specific resource', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:*', 'arn:aws:s3:::my-bucket/*')] })
    expect(findings.some(f => f.title.includes('S3') && f.severity === 'warning')).toBe(false)
  })

  it('flags ec2:* action', () => {
    const findings = evaluatePolicy({ Statement: [allow('ec2:*', 'arn:aws:ec2:*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('EC2'))).toBe(true)
  })

  it('flags sts:AssumeRole with wildcard resource', () => {
    const findings = evaluatePolicy({ Statement: [allow('sts:AssumeRole', '*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('AssumeRole'))).toBe(true)
  })

  it('flags Principal:* in bucket policy statement', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:GetObject', 'arn:aws:s3:::bucket/*', '*')] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('Public'))).toBe(true)
  })

  it('flags Principal object with wildcard value { AWS: "*" }', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:GetObject', 'arn:aws:s3:::bucket/*', { AWS: '*' })] })
    expect(findings.some(f => f.severity === 'warning' && f.title.includes('Public'))).toBe(true)
  })

  // INFO rules
  it('flags iam:PassRole', () => {
    const findings = evaluatePolicy({ Statement: [allow('iam:PassRole', '*')] })
    expect(findings.some(f => f.severity === 'info' && f.title.includes('PassRole'))).toBe(true)
  })

  it('flags cross-account trust in Principal', () => {
    const findings = evaluatePolicy({
      Statement: [allow('sts:AssumeRole', '*', { AWS: 'arn:aws:iam::999999999999:root' })]
    })
    expect(findings.some(f => f.severity === 'info' && f.title.toLowerCase().includes('cross-account'))).toBe(true)
  })

  // Deny and benign
  it('skips Deny statements entirely', () => {
    const findings = evaluatePolicy({ Statement: [deny('*', '*')] })
    expect(findings).toHaveLength(0)
  })

  it('returns empty for benign scoped policy', () => {
    const findings = evaluatePolicy({ Statement: [allow('s3:GetObject', 'arn:aws:s3:::my-bucket/*')] })
    expect(findings).toHaveLength(0)
  })

  // Action normalization — single string vs array
  it('handles single-string Action (not array)', () => {
    const findings = evaluatePolicy({ Statement: [allow('iam:*', 'arn:aws:iam::*:*')] })
    expect(findings.some(f => f.severity === 'critical')).toBe(true)
  })
})
