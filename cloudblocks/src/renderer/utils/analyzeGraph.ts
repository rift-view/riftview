import type { CloudNode, Advisory } from '../types/cloud'

export function analyzeGraph(nodes: CloudNode[]): Advisory[] {
  const advisories: Advisory[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))

  for (const node of nodes) {
    if (node.type !== 'apigw') continue

    // Find Lambda targets via integrations
    const lambdaTargets = (node.integrations ?? [])
      .map((e) => byId.get(e.targetId))
      .filter((n): n is CloudNode => n?.type === 'lambda')

    for (const lambda of lambdaTargets) {
      const hasTimeout =
        typeof lambda.metadata.timeout === 'number' &&
        (lambda.metadata.timeout as number) > 0
      if (hasTimeout) continue

      // Find RDS targets from this Lambda's integrations
      const rdsTargets = (lambda.integrations ?? [])
        .map((e) => byId.get(e.targetId))
        .filter((n): n is CloudNode => n?.type === 'rds')

      for (const rds of rdsTargets) {
        const hasReplica =
          rds.metadata.multiAZ === true ||
          (rds.metadata.readReplicaCount as number) > 0
        if (hasReplica) continue

        advisories.push({
          ruleId: 'apigw-lambda-rds-no-guardrails',
          severity: 'critical',
          title: 'Unguarded API→Lambda→RDS chain',
          detail: `API Gateway "${node.label}" routes to Lambda "${lambda.label}" (no timeout) → RDS "${rds.label}" (no read replica). A traffic spike exhausts RDS connections with no circuit breaker.`,
          nodeId: node.id,
        })
      }
    }
  }

  return advisories
}
