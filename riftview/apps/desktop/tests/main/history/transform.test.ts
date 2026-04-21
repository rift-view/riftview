import { describe, expect, it } from 'vitest'
import type { CloudNode, NodeType } from '@riftview/shared'
import { REDACTED, toSnapshotRecord } from '../../../src/main/history/transform'

function node(type: NodeType, metadata: Record<string, unknown> = {}): CloudNode {
  return {
    id: `${type}-1`,
    type,
    label: `${type}-1`,
    status: 'running',
    region: 'us-east-1',
    metadata
  }
}

const ALL_NODE_TYPES: NodeType[] = [
  'ec2',
  'vpc',
  'subnet',
  'rds',
  's3',
  'lambda',
  'alb',
  'security-group',
  'igw',
  'acm',
  'cloudfront',
  'apigw',
  'apigw-route',
  'sqs',
  'secret',
  'ecr-repo',
  'sns',
  'dynamo',
  'ssm-param',
  'nat-gateway',
  'r53-zone',
  'sfn',
  'eventbridge-bus',
  'ses',
  'cognito',
  'kinesis',
  'ecs',
  'elasticache',
  'eks',
  'opensearch',
  'msk',
  'unknown'
]

describe('history/transform', () => {
  describe('coverage', () => {
    it('handles all 32 NodeType values without throwing', () => {
      for (const t of ALL_NODE_TYPES) {
        const rec = toSnapshotRecord(node(t))
        expect(rec.shape).toBeDefined()
        expect(rec.data).toBeDefined()
      }
    })

    it('empty metadata produces empty shape and data', () => {
      const rec = toSnapshotRecord(node('vpc'))
      expect(rec.shape).toEqual({})
      expect(rec.data).toEqual({})
    })
  })

  describe('shape/data split', () => {
    it('routes unknown-keyed metadata to shape by default', () => {
      const rec = toSnapshotRecord(node('vpc', { cidr: '10.0.0.0/16', tenancy: 'default' }))
      expect(rec.shape).toEqual({ cidr: '10.0.0.0/16', tenancy: 'default' })
      expect(rec.data).toEqual({})
    })

    it('routes documented data-pointer keys to data — RDS', () => {
      const rec = toSnapshotRecord(
        node('rds', {
          engine: 'postgres',
          instanceClass: 'db.t3.micro',
          latestSnapshotArn: 'arn:aws:rds:us-east-1:123:snapshot:rds-db-auto-20260420',
          pitrEarliestRestoreTime: '2026-04-15T00:00:00Z'
        })
      )
      expect(rec.shape).toEqual({ engine: 'postgres', instanceClass: 'db.t3.micro' })
      expect(rec.data).toEqual({
        latestSnapshotArn: 'arn:aws:rds:us-east-1:123:snapshot:rds-db-auto-20260420',
        pitrEarliestRestoreTime: '2026-04-15T00:00:00Z'
      })
    })

    it('routes Lambda codeSha256 + codeSource to data', () => {
      const rec = toSnapshotRecord(
        node('lambda', {
          runtime: 'nodejs20.x',
          handler: 'index.handler',
          codeSha256: 'abc123',
          codeSource: { type: 's3', bucket: 'b', key: 'k' }
        })
      )
      expect(rec.shape).toEqual({ runtime: 'nodejs20.x', handler: 'index.handler' })
      expect(rec.data).toEqual({
        codeSha256: 'abc123',
        codeSource: { type: 's3', bucket: 'b', key: 'k' }
      })
    })

    it('no field appears in both shape and data for any NodeType', () => {
      for (const t of ALL_NODE_TYPES) {
        const rec = toSnapshotRecord(
          node(t, {
            keyA: 1,
            latestSnapshotArn: 'x',
            codeSha256: 'x',
            inflightMessageCount: 5,
            value: 'v',
            records: []
          })
        )
        const shapeKeys = Object.keys(rec.shape)
        const dataKeys = Object.keys(rec.data)
        expect(shapeKeys.some((k) => dataKeys.includes(k))).toBe(false)
      }
    })

    it('unknown NodeType keeps full metadata in shape, empty data', () => {
      const rec = toSnapshotRecord(
        node('unknown', { whateverField: 1, latestSnapshotArn: 'should-stay-in-shape' })
      )
      expect(rec.shape).toEqual({ whateverField: 1, latestSnapshotArn: 'should-stay-in-shape' })
      expect(rec.data).toEqual({})
    })
  })

  describe('global key-name redaction', () => {
    it('redacts keys matching password/secret/token/apikey/privatekey (case-insensitive)', () => {
      const rec = toSnapshotRecord(
        node('lambda', {
          runtime: 'nodejs20.x',
          dbPassword: 'hunter2',
          API_TOKEN: 'bearer-xyz',
          apiKey: 'k',
          privateKey: '-----BEGIN-----'
        })
      )
      expect(rec.shape.dbPassword).toBe(REDACTED)
      expect(rec.shape.API_TOKEN).toBe(REDACTED)
      expect(rec.shape.apiKey).toBe(REDACTED)
      expect(rec.shape.privateKey).toBe(REDACTED)
      expect(rec.shape.runtime).toBe('nodejs20.x')
    })

    it('redacts nested secret-shaped keys recursively', () => {
      const rec = toSnapshotRecord(
        node('vpc', {
          nested: { deep: { apiSecret: 's', normal: 1 } }
        })
      )
      const nested = rec.shape.nested as { deep: { apiSecret: string; normal: number } }
      expect(nested.deep.apiSecret).toBe(REDACTED)
      expect(nested.deep.normal).toBe(1)
    })

    it('redacts secret-shaped keys inside arrays of objects', () => {
      const rec = toSnapshotRecord(
        node('vpc', {
          rules: [
            { name: 'ok', password: 'pw1' },
            { name: 'also-ok', apikey: 'k2' }
          ]
        })
      )
      const rules = rec.shape.rules as { name: string; password?: string; apikey?: string }[]
      expect(rules[0].password).toBe(REDACTED)
      expect(rules[0].name).toBe('ok')
      expect(rules[1].apikey).toBe(REDACTED)
    })
  })

  describe('per-NodeType redaction rules', () => {
    it('secret: redacts SecretString and SecretBinary if leaked into metadata', () => {
      const rec = toSnapshotRecord(
        node('secret', {
          SecretString: 'plaintext-leak',
          SecretBinary: 'binarydata',
          arn: 'arn:aws:secretsmanager:us-east-1:123:secret:x'
        })
      )
      expect(rec.shape.SecretString).toBe(REDACTED)
      expect(rec.shape.SecretBinary).toBe(REDACTED)
      expect(rec.shape.arn).toBe('arn:aws:secretsmanager:us-east-1:123:secret:x')
    })

    it('ssm-param SecureString: redacts value in both shape and data', () => {
      const rec = toSnapshotRecord(
        node('ssm-param', { type: 'SecureString', value: 'sensitive-string' })
      )
      expect(rec.data.value).toBe(REDACTED)
      expect(rec.shape.type).toBe('SecureString')
    })

    it('ssm-param String: value flows through to data unmodified', () => {
      const rec = toSnapshotRecord(node('ssm-param', { type: 'String', value: 'public-config' }))
      expect(rec.data.value).toBe('public-config')
      expect(rec.shape.type).toBe('String')
    })

    it('lambda: collapses Environment.Variables values to keys-only', () => {
      const rec = toSnapshotRecord(
        node('lambda', {
          runtime: 'nodejs20.x',
          environment: {
            variables: {
              DATABASE_URL: 'postgres://user:pass@host',
              FEATURE_FLAG: 'true'
            }
          }
        })
      )
      const env = rec.shape.environment as { variables: string[] }
      expect(env.variables).toEqual(['DATABASE_URL', 'FEATURE_FLAG'])
    })

    it('lambda: empty Environment.Variables becomes empty key list', () => {
      const rec = toSnapshotRecord(
        node('lambda', {
          environment: { variables: {} }
        })
      )
      const env = rec.shape.environment as { variables: string[] }
      expect(env.variables).toEqual([])
    })

    it('lambda: absent environment field — no crash', () => {
      const rec = toSnapshotRecord(node('lambda', { runtime: 'nodejs20.x' }))
      expect(rec.shape.runtime).toBe('nodejs20.x')
    })

    it('acm: redacts PrivateKey if leaked into metadata', () => {
      const rec = toSnapshotRecord(
        node('acm', {
          domainName: 'example.com',
          PrivateKey: '-----BEGIN-----'
        })
      )
      expect(rec.shape.PrivateKey).toBe(REDACTED)
      expect(rec.shape.domainName).toBe('example.com')
    })
  })

  describe('defense-in-depth — planted secrets across all NodeTypes', () => {
    it('every NodeType redacts a planted secret-keyed field', () => {
      for (const t of ALL_NODE_TYPES) {
        const rec = toSnapshotRecord(node(t, { tags: { arbitrary: 'ok' }, secretToken: 'leak-me' }))
        const hasLeak = Object.values(rec.shape).some((v) => v === 'leak-me')
        expect(hasLeak, `leak survived for NodeType=${t}`).toBe(false)
      }
    })
  })

  describe('determinism', () => {
    it('returns the same shape for equivalent input regardless of key order', () => {
      const a = toSnapshotRecord(node('vpc', { cidr: '10.0.0.0/16', tenancy: 'default' }))
      const b = toSnapshotRecord(node('vpc', { tenancy: 'default', cidr: '10.0.0.0/16' }))
      expect(a).toEqual(b)
    })
  })
})
