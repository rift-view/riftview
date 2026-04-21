import { describe, it, expect } from 'vitest'
import { sortAdvisories } from '../src/analysis/sortAdvisories'
import type { Advisory } from '../src/types/cloud'

function makeAdvisory(
  ruleId: Advisory['ruleId'],
  severity: Advisory['severity'],
  title = 'Test Advisory'
): Advisory {
  return { ruleId, severity, title, detail: `Detail for ${ruleId}`, nodeId: 'node-1' }
}

describe('sortAdvisories', () => {
  it('returns an empty array when given an empty array', () => {
    expect(sortAdvisories([])).toEqual([])
  })

  it('preserves insertion order when all items are critical', () => {
    const a = makeAdvisory('ec2-public-ssh', 'critical', 'A')
    const b = makeAdvisory('lambda-no-timeout', 'critical', 'B')
    const c = makeAdvisory('s3-public-access', 'critical', 'C')
    const result = sortAdvisories([a, b, c])
    expect(result).toEqual([a, b, c])
  })

  it('preserves insertion order when all items are warnings', () => {
    const a = makeAdvisory('lambda-low-memory', 'warning', 'A')
    const b = makeAdvisory('sqs-no-dlq', 'warning', 'B')
    const c = makeAdvisory('rds-no-backup', 'warning', 'C')
    const result = sortAdvisories([a, b, c])
    expect(result).toEqual([a, b, c])
  })

  it('places criticals before warnings in mixed input', () => {
    const w = makeAdvisory('sqs-no-dlq', 'warning')
    const c = makeAdvisory('ec2-public-ssh', 'critical')
    const result = sortAdvisories([w, c])
    expect(result[0].severity).toBe('critical')
    expect(result[1].severity).toBe('warning')
  })

  it('moves a trailing critical to the front', () => {
    const w1 = makeAdvisory('sqs-no-dlq', 'warning', 'W1')
    const w2 = makeAdvisory('rds-no-backup', 'warning', 'W2')
    const c = makeAdvisory('ec2-public-ssh', 'critical', 'C')
    const result = sortAdvisories([w1, w2, c])
    expect(result[0]).toEqual(c)
    expect(result[1]).toEqual(w1)
    expect(result[2]).toEqual(w2)
  })

  it('keeps internal order within each severity block', () => {
    const c1 = makeAdvisory('ec2-public-ssh', 'critical', 'C1')
    const c2 = makeAdvisory('s3-public-access', 'critical', 'C2')
    const w1 = makeAdvisory('lambda-low-memory', 'warning', 'W1')
    const w2 = makeAdvisory('sqs-no-dlq', 'warning', 'W2')
    // Input: w1, c1, w2, c2
    const result = sortAdvisories([w1, c1, w2, c2])
    expect(result[0]).toEqual(c1)
    expect(result[1]).toEqual(c2)
    expect(result[2]).toEqual(w1)
    expect(result[3]).toEqual(w2)
  })

  it('does not mutate the input array', () => {
    const w = makeAdvisory('sqs-no-dlq', 'warning')
    const c = makeAdvisory('ec2-public-ssh', 'critical')
    const input = [w, c]
    const inputCopy = [...input]
    sortAdvisories(input)
    expect(input).toEqual(inputCopy)
  })

  it('returns a single advisory as-is', () => {
    const a = makeAdvisory('lambda-no-timeout', 'warning')
    expect(sortAdvisories([a])).toEqual([a])
  })

  it('handles info severity — info comes after warning and critical', () => {
    const info = makeAdvisory('lambda-low-memory', 'info', 'I')
    const warn = makeAdvisory('sqs-no-dlq', 'warning', 'W')
    const crit = makeAdvisory('ec2-public-ssh', 'critical', 'C')
    const result = sortAdvisories([info, warn, crit])
    expect(result[0]).toEqual(crit)
    expect(result[1]).toEqual(warn)
    expect(result[2]).toEqual(info)
  })
})
