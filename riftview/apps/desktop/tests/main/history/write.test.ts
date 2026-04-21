import { describe, expect, it } from 'vitest'
import type { CloudNode, NodeStatus } from '@riftview/shared'
import {
  closeDb,
  openDb,
  prepareStatements,
  type Db,
  type Statements
} from '../../../src/main/history/db'
import { deriveEdges, writeSnapshot } from '../../../src/main/history/write'

function node(
  id: string,
  opts: { region?: string; type?: CloudNode['type']; status?: NodeStatus } = {}
): CloudNode {
  return {
    id,
    type: opts.type ?? 'ec2',
    label: id,
    status: opts.status ?? 'running',
    region: opts.region ?? 'us-east-1',
    metadata: {}
  }
}

function setupDb(): { db: Db; stmts: Statements } {
  const db = openDb(':memory:')
  const stmts = prepareStatements(db)
  return { db, stmts }
}

const frozenClock = (): Date => new Date('2026-04-20T12:00:00Z')

describe('history/write', () => {
  describe('deriveEdges', () => {
    it('returns empty for nodes with no integrations', () => {
      expect(deriveEdges([node('n1'), node('n2')])).toEqual([])
    })

    it('flattens per-node integrations into EdgeRecords', () => {
      const nodes: CloudNode[] = [
        { ...node('n1'), integrations: [{ targetId: 'n2', edgeType: 'trigger' }] },
        {
          ...node('n2'),
          integrations: [
            { targetId: 'n3', edgeType: 'subscription' },
            { targetId: 'n4', edgeType: 'origin' }
          ]
        }
      ]
      expect(deriveEdges(nodes)).toEqual([
        { from: 'n1', to: 'n2', edgeType: 'trigger' },
        { from: 'n2', to: 'n3', edgeType: 'subscription' },
        { from: 'n2', to: 'n4', edgeType: 'origin' }
      ])
    })
  })

  describe('writeSnapshot — single region', () => {
    it('writes a versions row + matching nodes + edges in one transaction', () => {
      const { db, stmts } = setupDb()
      try {
        const result = writeSnapshot(
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
              { ...node('n1'), integrations: [{ targetId: 'n2', edgeType: 'trigger' }] },
              node('n2')
            ]
          },
          50,
          frozenClock
        )
        expect(result.versionIds).toHaveLength(1)

        const version = stmts.selectVersionById.get(result.versionIds[0]) as {
          profile: string
          region: string
          content_hash: string
        }
        expect(version.profile).toBe('default')
        expect(version.region).toBe('us-east-1')
        expect(version.content_hash).toMatch(/^[0-9a-f]{64}$/)

        const nodes = stmts.selectNodesByVersion.all(result.versionIds[0]) as { node_id: string }[]
        expect(nodes.map((n) => n.node_id)).toEqual(['n1', 'n2'])

        const edges = stmts.selectEdgesByVersion.all(result.versionIds[0]) as {
          from_id: string
          to_id: string
          edge_type: string
          edge_data_json: string | null
        }[]
        expect(edges).toHaveLength(1)
        expect(edges[0].from_id).toBe('n1')
        expect(edges[0].to_id).toBe('n2')
        expect(edges[0].edge_type).toBe('trigger')
        expect(edges[0].edge_data_json).toBeNull()
      } finally {
        closeDb(db)
      }
    })

    it('persists shape + data split on nodes (JSON columns)', () => {
      const { db, stmts } = setupDb()
      try {
        const result = writeSnapshot(
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
              {
                ...node('db-1', { type: 'rds' }),
                metadata: {
                  engine: 'postgres',
                  latestSnapshotArn: 'arn:aws:rds:us-east-1:123:snapshot:x'
                }
              }
            ]
          },
          50,
          frozenClock
        )

        const row = stmts.selectNodesByVersion.all(result.versionIds[0])[0] as {
          shape_json: string
          data_json: string
        }
        expect(JSON.parse(row.shape_json)).toEqual({ engine: 'postgres' })
        expect(JSON.parse(row.data_json)).toEqual({
          latestSnapshotArn: 'arn:aws:rds:us-east-1:123:snapshot:x'
        })
      } finally {
        closeDb(db)
      }
    })

    it('serializes integrations / tfMetadata / driftStatus when present, null when absent', () => {
      const { db, stmts } = setupDb()
      try {
        const result = writeSnapshot(
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
              {
                ...node('n-with'),
                integrations: [{ targetId: 'n-x', edgeType: 'trigger' }],
                tfMetadata: { resource: 'aws_instance.foo' },
                driftStatus: 'matched'
              },
              node('n-without')
            ]
          },
          50,
          frozenClock
        )

        const rows = stmts.selectNodesByVersion.all(result.versionIds[0]) as {
          node_id: string
          integrations_json: string | null
          tf_metadata_json: string | null
          drift_status: string | null
        }[]
        const byId = new Map(rows.map((r) => [r.node_id, r]))

        expect(byId.get('n-with')?.integrations_json).toBe(
          JSON.stringify([{ targetId: 'n-x', edgeType: 'trigger' }])
        )
        expect(byId.get('n-with')?.tf_metadata_json).toBe(
          JSON.stringify({ resource: 'aws_instance.foo' })
        )
        expect(byId.get('n-with')?.drift_status).toBe('matched')

        expect(byId.get('n-without')?.integrations_json).toBe(null)
        expect(byId.get('n-without')?.tf_metadata_json).toBe(null)
        expect(byId.get('n-without')?.drift_status).toBe(null)
      } finally {
        closeDb(db)
      }
    })
  })

  describe('writeSnapshot — multi-region', () => {
    it('writes one versions row per scanned region, grouping nodes by region', () => {
      const { db, stmts } = setupDb()
      try {
        const result = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1', 'us-west-2'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [
              node('east-1', { region: 'us-east-1' }),
              node('east-2', { region: 'us-east-1' }),
              node('west-1', { region: 'us-west-2' })
            ]
          },
          50,
          frozenClock
        )

        expect(result.versionIds).toHaveLength(2)

        const counts = result.versionIds.map((id) => {
          const v = stmts.selectVersionById.get(id) as { region: string }
          const nodes = stmts.selectNodesByVersion.all(id) as unknown[]
          return { region: v.region, count: nodes.length }
        })
        const byRegion = new Map(counts.map((c) => [c.region, c.count]))
        expect(byRegion.get('us-east-1')).toBe(2)
        expect(byRegion.get('us-west-2')).toBe(1)
      } finally {
        closeDb(db)
      }
    })

    it('writes an empty versions row for a scanned region with zero nodes', () => {
      const { db, stmts } = setupDb()
      try {
        const result = writeSnapshot(
          db,
          stmts,
          {
            profile: 'default',
            endpoint: null,
            regions: ['us-east-1', 'eu-west-1'],
            pluginId: 'com.riftview.aws',
            pluginVersion: '0.1.0',
            scanErrors: [],
            nodes: [node('only-east', { region: 'us-east-1' })]
          },
          50,
          frozenClock
        )
        expect(result.versionIds).toHaveLength(2)
      } finally {
        closeDb(db)
      }
    })
  })

  describe('writeSnapshot — prune on write', () => {
    it('enforces retention limit after the insert', () => {
      const { db, stmts } = setupDb()
      try {
        // Write 4 snapshots with distinct clock stamps
        for (let i = 0; i < 4; i++) {
          const clock = (): Date => new Date(2026, 3, 20, 12, 0, i)
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
            2,
            clock
          )
        }

        expect(stmts.countVersions.get()).toEqual({ n: 2 })
      } finally {
        closeDb(db)
      }
    })
  })

  describe('writeSnapshot — content hash', () => {
    it('produces a stable 64-char hex hash for the same canonical payload', () => {
      const { db, stmts } = setupDb()
      try {
        const input = {
          profile: 'default',
          endpoint: null,
          regions: ['us-east-1'],
          pluginId: 'com.riftview.aws',
          pluginVersion: '0.1.0',
          scanErrors: [],
          nodes: [node('a'), node('b')]
        }
        const r1 = writeSnapshot(db, stmts, input, 50, frozenClock)
        const r2 = writeSnapshot(db, stmts, input, 50, frozenClock)

        const h1 = (stmts.selectVersionById.get(r1.versionIds[0]) as { content_hash: string })
          .content_hash
        const h2 = (stmts.selectVersionById.get(r2.versionIds[0]) as { content_hash: string })
          .content_hash

        expect(h1).toMatch(/^[0-9a-f]{64}$/)
        expect(h1).toBe(h2)
      } finally {
        closeDb(db)
      }
    })
  })
})
