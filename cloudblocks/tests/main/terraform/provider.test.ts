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
    expect(result).toContain('apigatewayv2')
    expect(result).toContain('dynamodb')
    expect(result).toContain('lambda')
    expect(result).toContain('s3')
    expect(result).toContain('secretsmanager')
    expect(result).toContain('sns')
    expect(result).toContain('sqs')
  })

  it('ends with a trailing newline so template body starts on new line', () => {
    const result = buildLocalStackProvider('us-east-1')
    expect(result.endsWith('\n')).toBe(true)
  })
})
