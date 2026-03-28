import {
  EventBridgeClient,
  ListEventBusesCommand,
  ListRulesCommand,
  ListTargetsByRuleCommand,
} from '@aws-sdk/client-eventbridge'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

const ALLOWED_TARGET_PREFIXES = [
  'arn:aws:lambda:',
  'arn:aws:sqs:',
  'arn:aws:states:',
  'arn:aws:sns:',
]

function isAllowedTarget(arn: string): boolean {
  return ALLOWED_TARGET_PREFIXES.some((prefix) => arn.startsWith(prefix))
}

export async function listEventBuses(client: EventBridgeClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListEventBusesCommand({}))
    const buses = res.EventBuses ?? []

    const enrichedBuses = await Promise.all(
      buses.map(async (bus): Promise<CloudNode> => {
        const busArn = bus.Arn ?? ''

        const rulesRes = await client
          .send(new ListRulesCommand({ EventBusName: bus.Name }))
          .catch(() => ({ Rules: [] }))

        const rules = rulesRes.Rules ?? []
        const ruleCount = rules.length
        const hasDisabledRules = rules.some((r) => r.State === 'DISABLED')

        const allTargets = await Promise.all(
          rules.map(async (rule) => {
            if (!rule.Name) return []
            const targetsRes = await client
              .send(new ListTargetsByRuleCommand({ Rule: rule.Name, EventBusName: bus.Name }))
              .catch(() => ({ Targets: [] }))
            return targetsRes.Targets ?? []
          })
        )

        const integrations: { targetId: string; edgeType: EdgeType }[] = allTargets
          .flat()
          .filter((t): t is typeof t & { Arn: string } => t.Arn != null && isAllowedTarget(t.Arn))
          .map((t) => ({ targetId: t.Arn, edgeType: 'trigger' as EdgeType }))

        const node: CloudNode = {
          id: busArn,
          type: 'eventbridge-bus',
          label: bus.Name ?? '',
          status: 'running',
          region,
          metadata: {
            policy: bus.Policy ? 'custom' : 'default',
            ruleCount,
            hasDisabledRules,
          },
        }

        return integrations.length > 0 ? { ...node, integrations } : node
      })
    )

    return enrichedBuses
  } catch {
    return []
  }
}
