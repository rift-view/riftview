import { describe, it, expect } from 'vitest'
import { buildAdvisoryRemediation } from '../../../src/renderer/utils/buildAdvisoryRemediations'
import type { Advisory } from '../../../src/renderer/types/cloud'

function makeAdvisory(ruleId: Advisory['ruleId']): Advisory {
  return { ruleId, severity: 'warning', title: '', detail: '', nodeId: 'node-1' }
}

describe('buildAdvisoryRemediation', () => {
  it('returns s3 public access block command', () => {
    const cmds = buildAdvisoryRemediation(makeAdvisory('s3-public-access'), 'my-bucket')
    expect(cmds).not.toBeNull()
    expect(cmds![0]).toContain('put-public-access-block')
    expect(cmds![0]).toContain('my-bucket')
  })

  it('returns rds deletion-protection command', () => {
    const cmds = buildAdvisoryRemediation(makeAdvisory('rds-no-deletion-protection'), 'my-db')
    expect(cmds).not.toBeNull()
    expect(cmds![0]).toContain('modify-db-instance')
    expect(cmds![0]).toContain('my-db')
    expect(cmds![0]).toContain('--deletion-protection')
  })

  it('returns rds backup retention command', () => {
    const cmds = buildAdvisoryRemediation(makeAdvisory('rds-no-backup'), 'my-db')
    expect(cmds).not.toBeNull()
    expect(cmds![0]).toContain('--backup-retention-period')
    expect(cmds![0]).toContain('7')
  })

  it('returns null for rules without automated fix', () => {
    expect(buildAdvisoryRemediation(makeAdvisory('ec2-public-ssh'), 'i-123')).toBeNull()
    expect(buildAdvisoryRemediation(makeAdvisory('lambda-low-memory'), 'fn-arn')).toBeNull()
    expect(buildAdvisoryRemediation(makeAdvisory('sqs-no-dlq'), 'queue-arn')).toBeNull()
  })
})
