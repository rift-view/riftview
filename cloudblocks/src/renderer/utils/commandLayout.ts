import type { Node } from '@xyflow/react'
import type { CloudNode, NodeType } from '../types/cloud'

// ── Tier mapping ──────────────────────────────────────────────────────────────

export const NODE_TIER: Partial<Record<NodeType, number>> = {
  // Tier 0 — Internet / DNS
  'igw': 0, 'cloudfront': 0, 'acm': 0, 'r53-zone': 0,

  // Tier 1 — Edge / Gateway
  'alb': 1, 'apigw': 1, 'apigw-route': 1,

  // Tier 2 — Compute
  'lambda': 2, 'ec2': 2, 'ecs': 2, 'eks': 2,

  // Tier 3 — Data
  'rds': 3, 'dynamo': 3, 's3': 3, 'opensearch': 3, 'kinesis': 3, 'elasticache': 3, 'msk': 3,

  // Tier 4 — Messaging
  'sqs': 4, 'sns': 4, 'eventbridge-bus': 4, 'sfn': 4, 'ses': 4,

  // Tier 5 — Config / Identity
  'ssm-param': 5, 'secret': 5, 'cognito': 5, 'ecr-repo': 5,
}

export const DEFAULT_TIER = 6

const EXCLUDED: Set<NodeType> = new Set(['vpc', 'subnet', 'security-group', 'nat-gateway'])

const TIER_NAMES = ['Internet', 'Edge', 'Compute', 'Data', 'Messaging', 'Config', 'Other'] as const

// ── Layout constants ──────────────────────────────────────────────────────────

const CMD_NODE_W  = 150
const CMD_NODE_H  = 66
const CMD_GAP_X   = 12
const CMD_COLS    = 8
const CMD_TIER_H  = CMD_NODE_H + 80   // node height + gap including label space
const LANE_TOP    = 60
const LANE_X      = 200               // left margin for tier labels

// ── buildCommandNodes — pure function ────────────────────────────────────────

export function buildCommandNodes(cloudNodes: CloudNode[]): Node[] {
  const serviceable = cloudNodes.filter((n) => !EXCLUDED.has(n.type as NodeType))

  // Group by tier
  const byTier = new Map<number, CloudNode[]>()
  for (const n of serviceable) {
    const tier = NODE_TIER[n.type as NodeType] ?? DEFAULT_TIER
    if (!byTier.has(tier)) byTier.set(tier, [])
    byTier.get(tier)!.push(n)
  }

  if (byTier.size === 0) return []

  const result: Node[] = []

  for (const [tier, nodes] of [...byTier.entries()].sort((a, b) => a[0] - b[0])) {
    const tierY = LANE_TOP + tier * CMD_TIER_H

    // Tier label node
    result.push({
      id:         `__tier_label_${tier}__`,
      type:       'tier-label',
      position:   { x: 0, y: tierY },
      draggable:  false,
      selectable: false,
      data:       { name: TIER_NAMES[tier] ?? `Tier ${tier}` },
    })

    // Resource nodes in a grid
    nodes.forEach((node, idx) => {
      const col = idx % CMD_COLS
      const row = Math.floor(idx / CMD_COLS)
      result.push({
        id:       node.id,
        type:     'resource',
        position: {
          x: LANE_X + col * (CMD_NODE_W + CMD_GAP_X),
          y: tierY + row * (CMD_NODE_H + 12),
        },
        data: {
          label:    node.label,
          nodeType: node.type,
          status:   node.status,
          region:   node.region,
          metadata: node.metadata,
        },
      })
    })
  }

  return result
}
