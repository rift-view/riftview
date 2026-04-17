import { describe, it, expect } from 'vitest'
import { analyzeNode } from '../../../src/renderer/utils/analyzeNode'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function node(overrides: Partial<CloudNode>): CloudNode {
  return {
    id: 'test-id',
    label: 'test',
    type: 'lambda',
    status: 'running',
    region: 'us-east-1',
    metadata: {},
    ...overrides
  } as CloudNode
}

describe('analyzeNode', () => {
  // ── lambda-no-timeout ──────────────────────────────────────────────────────
  it('lambda with no timeout → critical lambda-no-timeout', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: {} }))
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'lambda-no-timeout', severity: 'critical' })
      ])
    )
  })

  it('lambda with timeout=0 → critical lambda-no-timeout', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 0 } }))
    expect(r.some((a) => a.ruleId === 'lambda-no-timeout')).toBe(true)
  })

  it('lambda with timeout=30 → no lambda-no-timeout', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30 } }))
    expect(r.find((a) => a.ruleId === 'lambda-no-timeout')).toBeUndefined()
  })

  // ── lambda-low-memory ──────────────────────────────────────────────────────
  it('lambda with memorySize=128 → info lambda-low-memory', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, memorySize: 128 } }))
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'lambda-low-memory', severity: 'info' })
      ])
    )
  })

  it('lambda with memorySize=512 → info lambda-low-memory (at threshold)', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, memorySize: 512 } }))
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'lambda-low-memory', severity: 'info' })
      ])
    )
  })

  it('lambda with memorySize=511 → info lambda-low-memory (below threshold)', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, memorySize: 511 } }))
    expect(r.some((a) => a.ruleId === 'lambda-low-memory')).toBe(true)
  })

  it('lambda with memorySize=513 → no lambda-low-memory (above threshold)', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, memorySize: 513 } }))
    expect(r.find((a) => a.ruleId === 'lambda-low-memory')).toBeUndefined()
  })

  it('lambda with no memorySize → no lambda-low-memory', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30 } }))
    expect(r.find((a) => a.ruleId === 'lambda-low-memory')).toBeUndefined()
  })

  // ── ec2-public-ssh ────────────────────────────────────────────────────────
  it('ec2 with hasPublicSsh=true → critical ec2-public-ssh', () => {
    const r = analyzeNode(node({ type: 'ec2', metadata: { hasPublicSsh: true } }))
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'ec2-public-ssh', severity: 'critical' })
      ])
    )
  })

  it('ec2 with hasPublicSsh=false → no ec2-public-ssh', () => {
    const r = analyzeNode(node({ type: 'ec2', metadata: { hasPublicSsh: false } }))
    expect(r.find((a) => a.ruleId === 'ec2-public-ssh')).toBeUndefined()
  })

  it('ec2 with no hasPublicSsh → no ec2-public-ssh', () => {
    const r = analyzeNode(node({ type: 'ec2', metadata: {} }))
    expect(r.find((a) => a.ruleId === 'ec2-public-ssh')).toBeUndefined()
  })

  // ── s3-public-access ───────────────────────────────────────────────────────
  it('s3 with publicAccessEnabled=true → critical s3-public-access', () => {
    const r = analyzeNode(node({ type: 's3', metadata: { publicAccessEnabled: true } }))
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 's3-public-access', severity: 'critical' })
      ])
    )
  })

  it('s3 with publicAccessEnabled=false → no s3-public-access', () => {
    const r = analyzeNode(node({ type: 's3', metadata: { publicAccessEnabled: false } }))
    expect(r.find((a) => a.ruleId === 's3-public-access')).toBeUndefined()
  })

  it('s3 with no publicAccessEnabled → no s3-public-access', () => {
    const r = analyzeNode(node({ type: 's3', metadata: {} }))
    expect(r.find((a) => a.ruleId === 's3-public-access')).toBeUndefined()
  })

  // ── rds-no-multiaz ────────────────────────────────────────────────────────
  it('rds with multiAZ=false → warning rds-no-multiaz', () => {
    const r = analyzeNode(node({ type: 'rds', metadata: { multiAZ: false } }))
    expect(r).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: 'rds-no-multiaz', severity: 'warning' })
      ])
    )
  })

  it('rds with no multiAZ → warning rds-no-multiaz', () => {
    const r = analyzeNode(node({ type: 'rds', metadata: {} }))
    expect(r.some((a) => a.ruleId === 'rds-no-multiaz')).toBe(true)
  })

  it('rds with multiAZ=true → no rds-no-multiaz', () => {
    const r = analyzeNode(node({ type: 'rds', metadata: { multiAZ: true } }))
    expect(r.find((a) => a.ruleId === 'rds-no-multiaz')).toBeUndefined()
  })

  // ── type isolation ────────────────────────────────────────────────────────
  it('vpc node → no advisories', () => {
    expect(analyzeNode(node({ type: 'vpc', metadata: {} }))).toHaveLength(0)
  })

  it('advisory has nodeId matching the node', () => {
    const r = analyzeNode(node({ id: 'my-lambda', type: 'lambda', metadata: {} }))
    expect(r[0].nodeId).toBe('my-lambda')
  })

  it('advisory has non-empty title and detail', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: {} }))
    expect(r[0].title.length).toBeGreaterThan(0)
    expect(r[0].detail.length).toBeGreaterThan(0)
  })

  // ── sqs-no-dlq ────────────────────────────────────────────────────────────
  it('sqs with hasDlq=false → warning sqs-no-dlq', () => {
    const r = analyzeNode(node({ type: 'sqs', metadata: { hasDlq: false } }))
    expect(r.some((a) => a.ruleId === 'sqs-no-dlq')).toBe(true)
  })
  it('sqs with hasDlq=true → no sqs-no-dlq', () => {
    const r = analyzeNode(node({ type: 'sqs', metadata: { hasDlq: true } }))
    expect(r.find((a) => a.ruleId === 'sqs-no-dlq')).toBeUndefined()
  })

  // ── rds-no-deletion-protection ────────────────────────────────────────────
  it('rds with deletionProtection=false → warning rds-no-deletion-protection', () => {
    const r = analyzeNode(
      node({ type: 'rds', metadata: { multiAZ: true, deletionProtection: false } })
    )
    expect(r.some((a) => a.ruleId === 'rds-no-deletion-protection')).toBe(true)
  })
  it('rds with deletionProtection=true → no rds-no-deletion-protection', () => {
    const r = analyzeNode(
      node({ type: 'rds', metadata: { multiAZ: true, deletionProtection: true } })
    )
    expect(r.find((a) => a.ruleId === 'rds-no-deletion-protection')).toBeUndefined()
  })

  // ── rds-no-backup ─────────────────────────────────────────────────────────
  it('rds with backupRetentionPeriod=0 → critical rds-no-backup', () => {
    const r = analyzeNode(
      node({
        type: 'rds',
        metadata: { multiAZ: true, deletionProtection: true, backupRetentionPeriod: 0 }
      })
    )
    expect(r.some((a) => a.ruleId === 'rds-no-backup')).toBe(true)
  })
  it('rds with backupRetentionPeriod=7 → no rds-no-backup', () => {
    const r = analyzeNode(
      node({
        type: 'rds',
        metadata: { multiAZ: true, deletionProtection: true, backupRetentionPeriod: 7 }
      })
    )
    expect(r.find((a) => a.ruleId === 'rds-no-backup')).toBeUndefined()
  })

  // ── s3-no-versioning ──────────────────────────────────────────────────────
  it('s3 with versioningEnabled=false → warning s3-no-versioning', () => {
    const r = analyzeNode(
      node({ type: 's3', metadata: { publicAccessEnabled: false, versioningEnabled: false } })
    )
    expect(r.some((a) => a.ruleId === 's3-no-versioning')).toBe(true)
  })
  it('s3 with versioningEnabled=true → no s3-no-versioning', () => {
    const r = analyzeNode(
      node({ type: 's3', metadata: { publicAccessEnabled: false, versioningEnabled: true } })
    )
    expect(r.find((a) => a.ruleId === 's3-no-versioning')).toBeUndefined()
  })

  // ── lambda-no-dlq ─────────────────────────────────────────────────────────
  it('lambda with hasDlq=false → warning lambda-no-dlq', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, hasDlq: false } }))
    expect(r.some((a) => a.ruleId === 'lambda-no-dlq')).toBe(true)
  })
  it('lambda with hasDlq=true → no lambda-no-dlq', () => {
    const r = analyzeNode(node({ type: 'lambda', metadata: { timeout: 30, hasDlq: true } }))
    expect(r.find((a) => a.ruleId === 'lambda-no-dlq')).toBeUndefined()
  })

  // ── ecs-task-count-mismatch ───────────────────────────────────────────────
  it('ecs with runningCount < desiredCount → warning ecs-task-count-mismatch', () => {
    const r = analyzeNode(
      node({ type: 'ecs', metadata: { desiredCount: 3, runningCount: 1, launchType: 'FARGATE' } })
    )
    expect(r.some((a) => a.ruleId === 'ecs-task-count-mismatch')).toBe(true)
  })
  it('ecs with runningCount === desiredCount → no ecs-task-count-mismatch', () => {
    const r = analyzeNode(
      node({ type: 'ecs', metadata: { desiredCount: 2, runningCount: 2, launchType: 'FARGATE' } })
    )
    expect(r.find((a) => a.ruleId === 'ecs-task-count-mismatch')).toBeUndefined()
  })
  it('ecs with runningCount=0 desiredCount=0 → no ecs-task-count-mismatch', () => {
    const r = analyzeNode(node({ type: 'ecs', metadata: { desiredCount: 0, runningCount: 0 } }))
    expect(r.find((a) => a.ruleId === 'ecs-task-count-mismatch')).toBeUndefined()
  })

  // ── elasticache-no-replica ────────────────────────────────────────────────
  it('redis standalone → warning elasticache-no-replica', () => {
    const r = analyzeNode(
      node({ type: 'elasticache', metadata: { engine: 'redis', clusterMode: 'standalone' } })
    )
    expect(r.some((a) => a.ruleId === 'elasticache-no-replica')).toBe(true)
  })
  it('redis cluster mode → no elasticache-no-replica', () => {
    const r = analyzeNode(
      node({ type: 'elasticache', metadata: { engine: 'redis', clusterMode: 'cluster' } })
    )
    expect(r.find((a) => a.ruleId === 'elasticache-no-replica')).toBeUndefined()
  })
  it('memcached → no elasticache-no-replica', () => {
    const r = analyzeNode(node({ type: 'elasticache', metadata: { engine: 'memcached' } }))
    expect(r.find((a) => a.ruleId === 'elasticache-no-replica')).toBeUndefined()
  })

  // ── opensearch-no-vpc ─────────────────────────────────────────────────────
  it('opensearch with no parentId → warning opensearch-no-vpc', () => {
    const r = analyzeNode(
      node({ type: 'opensearch', metadata: { engineVersion: 'OpenSearch_2.11' } })
    )
    expect(r.some((a) => a.ruleId === 'opensearch-no-vpc')).toBe(true)
  })
  it('opensearch with parentId (in VPC) → no opensearch-no-vpc', () => {
    const r = analyzeNode(node({ type: 'opensearch', metadata: {}, parentId: 'vpc-12345' }))
    expect(r.find((a) => a.ruleId === 'opensearch-no-vpc')).toBeUndefined()
  })
})
