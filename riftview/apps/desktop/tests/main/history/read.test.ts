import { describe, expect, it } from 'vitest'
import type { CloudNode, NodeStatus, NodeType } from '@riftview/shared'
import {
  closeDb,
  openDb,
  prepareStatements,
  type Db,
  type Statements
} from '../../../src/main/history/db'
import { deleteSnapshot, listVersions, readSnapshot } from '../../../src/main/history/read'
import { writeSnapshot } from '../../../src/main/history/write'

function node(
  id: string,
  opts: {
    region?: string
    type?: NodeType
    status?: NodeStatus
    metadata?: Record<string, unknown>
  } = {}
): CloudNode {
  return {
    id,
    type: opts.type ?? 'ec2',
    label: id,
    status: opts.status ?? 'running',
    region: opts.region ?? 'us-east-1',
    metadata: opts.metadata ?? {}
  }
}

function setupDb(): { db: Db; stmts: Statements } {
  const db = openDb(':memory:')
  const stmts = prepareStatements(db)
  return { db, stmts }
}

function stepClock(offset = 0): () => Date {
  return () => new Date(2026, 3, 20, 12, 0, offset)
}

describe('history/read', () => {
  describe('listVersions', () => {
    it('empty DB returns empty array', () => {
      const { db, stmts } = setupDb()
      try {
        expect(listVersions(db, stmts)).toEqual([])
      } finally {
        closeDb(db)
      }
    })

    it('orders by timestamp descending and respects limit', () => {
      const { db, stmts } = setupDb()
      try {
        for (let i = 0; i < 5; i++) {
          writeSnapshot(
            db,
            stmts,
            {
              profile: 'default',
              endpoint: null,
              regions: ['us-east-1'],
              pluginId: 'com.riftview.aws',
              pluginVersion: '0.1.0',
              scanErrors: [],
              nodes: [node(`n-${i}`)]
            },
            50,
            stepClock(i)
          )
        }

        const all = listVersions(db, stmts)
        expect(all).toHaveLength(5)
        expect(all[0].timestamp > all[1].timestamp).toBe(true)

        const limited = listVersions(db, stmts, { limit: 2 })
        expect(limited).toHaveLength(2)
      } finally {
        closeDb(db)
      }
    })

    it('filters by profile', () => {
      const { db, stmts } = setupDb()
      try {
        for (const profile of ['dev', 'prod', 'staging']) {
          writeSnapshot(
            db,
            stmts,
            {
              profile,
              endpoint: null,
              regions: ['us-east-1'],
              pluginId: 'com.riftview.aws',
              pluginVersion: '0.1.0',
              scanErrors: [],
              nodes: []
            },
            50,
            stepClock(profile.length)
          )
        }

        const devOnly = listVersions(db, stmts, { profile: 'dev' })
        expect(devOnly).toHaveLength(1)
        expect(devOnly[0].profile).toBe('dev')
      } finally {
        closeDb(db)
      }
    })

    it('filters by profile + region together', () => {
      const { db, stmts } = setupDb()
      try {
        writeSnapshot(
          db,
          stmts,
          {
            profile: 'dev',
            endpoint: null,
            regions: ['us-east-1', 'us-west-2'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: []
          },
          50,
          stepClock(0)
        )

        const east = listVersions(db, stmts, { profile: 'dev', region: 'us-east-1' })
        expect(east).toHaveLength(1)
        expect(east[0].region).toBe('us-east-1')
      } finally {
        closeDb(db)
      }
    })

    it('preserves contentHash and scanMeta across list', () => {
      const { db, stmts } = setupDb()
      try {
        writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: ['s3/us-east-1: denied'],
            nodes: [node('n1')]
          },
          50,
          stepClock(0)
        )

        const [meta] = listVersions(db, stmts)
        expect(meta.contentHash).toMatch(/^[0-9a-f]{64}$/)
        expect(meta.scanMeta.nodeCount).toBe(1)
        expect(meta.scanMeta.scanErrors).toEqual(['s3/us-east-1: denied'])
        expect(meta.scanMeta.schemaVersion).toBe(1)
      } finally {
        closeDb(db)
      }
    })
  })

  describe('readSnapshot', () => {
    it('returns null for a nonexistent versionId (does not throw)', () => {
      const { db, stmts } = setupDb()
      try {
        expect(readSnapshot(db, stmts, '01ARZ3NDEKTSV4RRFFQ69G5FAV')).toBeNull()
      } finally {
        closeDb(db)
      }
    })

    it('returns meta + nodes + edges for an existing version', () => {
      const { db, stmts } = setupDb()
      try {
        const { versionIds } = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [
              { ...node('a'), integrations: [{ targetId: 'b', edgeType: 'trigger' }] },
              node('b')
            ]
          },
          50,
          stepClock(0)
        )

        const snap = readSnapshot(db, stmts, versionIds[0])
        expect(snap).not.toBeNull()
        expect(snap!.nodes.map((n) => n.id).sort()).toEqual(['a', 'b'])
        expect(snap!.edges).toEqual([{ from: 'a', to: 'b', edgeType: 'trigger' }])
        expect(snap!.meta.contentHash).toMatch(/^[0-9a-f]{64}$/)
      } finally {
        closeDb(db)
      }
    })
  })

  describe('round-trip — write → read → deepEqual up to redactions', () => {
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

    it('reconstructs an identical CloudNode for every NodeType (empty-metadata fixture)', () => {
      for (const t of ALL_NODE_TYPES) {
        const { db, stmts } = setupDb()
        try {
          const original = node(`${t}-1`, { type: t })
          const { versionIds } = writeSnapshot(
            db,
            stmts,
            {
              profile: 'default',
              endpoint: null,
              regions: ['us-east-1'],
              pluginId: 'com.riftview.aws',
              pluginVersion: '0.1.0',
              scanErrors: [],
              nodes: [original]
            },
            50,
            stepClock(0)
          )
          const snap = readSnapshot(db, stmts, versionIds[0])
          expect(snap!.nodes).toHaveLength(1)
          expect(snap!.nodes[0]).toEqual(original)
        } finally {
          closeDb(db)
        }
      }
    })

    it('reconstructs node with integrations + tfMetadata + driftStatus preserved', () => {
      const { db, stmts } = setupDb()
      try {
        const original: CloudNode = {
          ...node('rich-1', { type: 'ec2' }),
          parentId: 'vpc-1',
          integrations: [{ targetId: 'rds-1', edgeType: 'trigger' }],
          tfMetadata: { resource: 'aws_instance.foo' },
          driftStatus: 'matched'
        }
        const { versionIds } = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [original]
          },
          50,
          stepClock(0)
        )
        const snap = readSnapshot(db, stmts, versionIds[0])
        expect(snap!.nodes[0]).toEqual(original)
      } finally {
        closeDb(db)
      }
    })

    it('round-trip merges shape + data back into metadata — RDS', () => {
      const { db, stmts } = setupDb()
      try {
        const original: CloudNode = {
          ...node('db-1', { type: 'rds' }),
          metadata: {
            engine: 'postgres',
            instanceClass: 'db.t3.micro',
            latestSnapshotArn: 'arn:aws:rds:us-east-1:123:snapshot:x'
          }
        }
        const { versionIds } = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [original]
          },
          50,
          stepClock(0)
        )
        const snap = readSnapshot(db, stmts, versionIds[0])
        expect(snap!.nodes[0]).toEqual(original)
      } finally {
        closeDb(db)
      }
    })

    it('round-trip redacts secret-keyed fields — asserts redaction pattern, never original value', () => {
      const { db, stmts } = setupDb()
      try {
        const original: CloudNode = {
          ...node('with-secret'),
          metadata: { normal: 'public', apiToken: 'bearer-live-key' }
        }
        const { versionIds } = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [original]
          },
          50,
          stepClock(0)
        )
        const snap = readSnapshot(db, stmts, versionIds[0])
        const reconstructed = snap!.nodes[0]
        expect(reconstructed.metadata.normal).toBe('public')
        expect(reconstructed.metadata.apiToken).toBe('[redacted]')
      } finally {
        closeDb(db)
      }
    })
  })

  describe('deleteSnapshot', () => {
    it('removes the version + cascades to nodes + edges', () => {
      const { db, stmts } = setupDb()
      try {
        const { versionIds } = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [
              { ...node('a'), integrations: [{ targetId: 'b', edgeType: 'trigger' }] },
              node('b')
            ]
          },
          50,
          stepClock(0)
        )

        const result = deleteSnapshot(db, stmts, versionIds[0])
        expect(result.ok).toBe(true)
        expect(readSnapshot(db, stmts, versionIds[0])).toBeNull()
        expect(stmts.countVersions.get()).toEqual({ n: 0 })
      } finally {
        closeDb(db)
      }
    })

    it('returns ok=false when version does not exist', () => {
      const { db, stmts } = setupDb()
      try {
        const result = deleteSnapshot(db, stmts, 'nonexistent-ulid')
        expect(result.ok).toBe(false)
      } finally {
        closeDb(db)
      }
    })
  })
})
