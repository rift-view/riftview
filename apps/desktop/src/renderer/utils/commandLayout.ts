import type { Node } from '@xyflow/react'
import type { CloudNode, NodeType } from '@riftview/shared'

// ── Tier mapping ──────────────────────────────────────────────────────────────

export const NODE_TIER: Partial<Record<NodeType, number>> = {
  // Tier 0 — Internet / DNS
  'aws:igw': 0,
  'aws:cloudfront': 0,
  'aws:acm': 0,
  'aws:r53-zone': 0,

  // Tier 1 — Edge / Gateway
  'aws:alb': 1,
  'aws:apigw': 1,
  'aws:apigw-route': 1,

  // Tier 2 — Compute
  'aws:lambda': 2,
  'aws:ec2': 2,
  'aws:ecs': 2,
  'aws:eks': 2,

  // Tier 3 — Data
  'aws:rds': 3,
  'aws:dynamo': 3,
  'aws:s3': 3,
  'aws:opensearch': 3,
  'aws:kinesis': 3,
  'aws:elasticache': 3,
  'aws:msk': 3,

  // Tier 4 — Messaging
  'aws:sqs': 4,
  'aws:sns': 4,
  'aws:eventbridge-bus': 4,
  'aws:sfn': 4,
  'aws:ses': 4,

  // Tier 5 — Config / Identity
  'aws:ssm-param': 5,
  'aws:secret': 5,
  'aws:cognito': 5,
  'aws:ecr-repo': 5,

  // Hetzner — mirrors AWS tiers by role
  'hetzner:server': 2, // compute (tier-equivalent of aws:ec2)
  'hetzner:volume': 3, // data
  'hetzner:ssh-key': 5 // identity
}

export const DEFAULT_TIER = 6

const EXCLUDED: Set<NodeType> = new Set([
  'aws:vpc',
  'aws:subnet',
  'aws:security-group',
  'aws:nat-gateway',
  // Hetzner network / firewall behave like VPC / SG — context, not tier rows.
  'hetzner:network',
  'hetzner:firewall'
])

const TIER_NAMES = ['Internet', 'Edge', 'Compute', 'Data', 'Messaging', 'Config', 'Other'] as const

// ── Layout constants ──────────────────────────────────────────────────────────

const CMD_NODE_W = 150
const CMD_NODE_H = 66
const CMD_GAP_X = 12
const CMD_COLS = 8
const CMD_TIER_H = CMD_NODE_H + 80 // node height + gap including label space
const LANE_TOP = 60
const LANE_X = 200 // left margin for tier labels

// ── Crossing reduction — barycentric heuristic ───────────────────────────────
//
// For each tier (top-to-bottom), sort nodes by the average column-index of their
// connected neighbours that have already been placed. This is the classic
// "barycentric method" for reducing edge crossings in layered graphs.

function buildAdjacency(allNodes: CloudNode[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>()
  const ensure = (id: string): Set<string> => {
    if (!adj.has(id)) adj.set(id, new Set())
    return adj.get(id)!
  }
  for (const node of allNodes) {
    ensure(node.id)
    for (const { targetId } of node.integrations ?? []) {
      // targetId may be a raw ARN — resolve to node id via SNS pattern
      const resolved =
        allNodes.find(
          (n) =>
            n.id === targetId || n.metadata?.QueueArn === targetId || n.metadata?.arn === targetId
        )?.id ?? targetId
      ensure(node.id).add(resolved)
      ensure(resolved).add(node.id)
    }
  }
  return adj
}

function sortByBarycenter(
  nodes: CloudNode[],
  placed: Map<string, number> // nodeId → col index already placed
): CloudNode[] {
  const scored = nodes.map((n) => {
    const neighbors = [...placed.keys()].filter(() => false) // placeholder
    void neighbors
    // Collect placed neighbours
    const positions: number[] = []
    for (const [id, col] of placed) {
      if (id === n.id) continue
      positions.push(col) // will be filtered below
    }
    return { node: n, score: 0 }
  })
  return scored.map((s) => s.node)
}

function reduceCrossings(byTier: Map<number, CloudNode[]>, adj: Map<string, Set<string>>): void {
  const tierOrder = [...byTier.keys()].sort((a, b) => a - b)
  // placed: nodeId → column index within its tier (used for barycenter calc)
  const placed = new Map<string, number>()

  for (const tier of tierOrder) {
    const nodes = byTier.get(tier)!

    if (tier === tierOrder[0]) {
      // First tier: sort by degree descending so hub nodes are centered
      nodes.sort((a, b) => (adj.get(b.id)?.size ?? 0) - (adj.get(a.id)?.size ?? 0))
    } else {
      // Subsequent tiers: barycentric sort on already-placed neighbours
      nodes.sort((a, b) => barycenter(a.id, adj, placed) - barycenter(b.id, adj, placed))
    }

    nodes.forEach((n, i) => placed.set(n.id, i))
  }
}

function barycenter(
  nodeId: string,
  adj: Map<string, Set<string>>,
  placed: Map<string, number>
): number {
  const neighbors = adj.get(nodeId) ?? new Set()
  const positions: number[] = []
  for (const nb of neighbors) {
    const p = placed.get(nb)
    if (p !== undefined) positions.push(p)
  }
  if (positions.length === 0) return 999 // unconnected: push to end
  return positions.reduce((s, p) => s + p, 0) / positions.length
}

// suppress unused import
void sortByBarycenter

// ── getTierForNode — exported for edge routing ────────────────────────────────

export function getTierForNode(nodeType: NodeType): number {
  return NODE_TIER[nodeType] ?? DEFAULT_TIER
}

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

  // Apply crossing reduction
  const adj = buildAdjacency(cloudNodes)
  reduceCrossings(byTier, adj)

  const result: Node[] = []

  for (const [tier, nodes] of [...byTier.entries()].sort((a, b) => a[0] - b[0])) {
    const tierY = LANE_TOP + tier * CMD_TIER_H

    // Tier label node
    result.push({
      id: `__tier_label_${tier}__`,
      type: 'tier-label',
      position: { x: 0, y: tierY },
      draggable: false,
      selectable: false,
      data: { name: TIER_NAMES[tier] ?? `Tier ${tier}` }
    })

    // Resource nodes in a grid
    nodes.forEach((node, idx) => {
      const col = idx % CMD_COLS
      const row = Math.floor(idx / CMD_COLS)
      result.push({
        id: node.id,
        type: 'resource',
        position: {
          x: LANE_X + col * (CMD_NODE_W + CMD_GAP_X),
          y: tierY + row * (CMD_NODE_H + 12)
        },
        data: {
          label: node.label,
          nodeType: node.type,
          status: node.status,
          region: node.region,
          metadata: node.metadata
        }
      })
    })
  }

  return result
}
