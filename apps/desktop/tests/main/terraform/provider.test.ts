import { describe, it, expect } from 'vitest'
import { buildLocalStackProvider } from '../../../src/main/terraform/provider'

describe('buildLocalStackProvider', () => {
  it('returns a string containing the terraform block', () => {
    const result = buildLocalStackProvider('us-east-1')
    expect(result).toContain('terraform {')
    expect(result).toContain('required_providers')
    expect(result).toContain('hashicorp/aws')
  })

  it('interpolates the region correctly', () => {
    const result = buildLocalStackProvider('eu-west-1')
    expect(result).toContain('region                      = "eu-west-1"')
  })

  it('uses test credentials for LocalStack', () => {
    const result = buildLocalStackProvider('us-east-1')
    expect(result).toContain('access_key                  = "test"')
    expect(result).toContain('secret_key                  = "test"')
  })

  it('includes all required LocalStack endpoints', () => {
    const result = buildLocalStackProvider('us-east-1')
    expect(result).toContain('apigatewayv2   = "http://localhost:4566"')
    expect(result).toContain('dynamodb       = "http://localhost:4566"')
    expect(result).toContain('ec2            = "http://localhost:4566"')
    expect(result).toContain('iam            = "http://localhost:4566"')
    expect(result).toContain('lambda         = "http://localhost:4566"')
    expect(result).toContain('s3             = "http://localhost:4566"')
    expect(result).toContain('secretsmanager = "http://localhost:4566"')
    expect(result).toContain('sns            = "http://localhost:4566"')
    expect(result).toContain('sqs            = "http://localhost:4566"')
    expect(result).toContain('sts            = "http://localhost:4566"')
  })

  it('uses custom endpoint when provided', () => {
    const result = buildLocalStackProvider('us-east-1', 'http://custom:4566')
    expect(result).toContain('apigatewayv2   = "http://custom:4566"')
    expect(result).toContain('dynamodb       = "http://custom:4566"')
    expect(result).toContain('ec2            = "http://custom:4566"')
    expect(result).toContain('iam            = "http://custom:4566"')
    expect(result).toContain('lambda         = "http://custom:4566"')
    expect(result).toContain('s3             = "http://custom:4566"')
    expect(result).toContain('secretsmanager = "http://custom:4566"')
    expect(result).toContain('sns            = "http://custom:4566"')
    expect(result).toContain('sqs            = "http://custom:4566"')
    expect(result).toContain('sts            = "http://custom:4566"')
  })

  it('ends with a trailing newline so template body starts on new line', () => {
    const result = buildLocalStackProvider('us-east-1')
    expect(result.endsWith('\n')).toBe(true)
  })
})
