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
        typeof lambda.metadata.timeout === 'number' && (lambda.metadata.timeout as number) > 0
      if (hasTimeout) continue

      // Find RDS targets from this Lambda's integrations
      const rdsTargets = (lambda.integrations ?? [])
        .map((e) => byId.get(e.targetId))
        .filter((n): n is CloudNode => n?.type === 'rds')

      for (const rds of rdsTargets) {
        const hasReplica =
          rds.metadata.multiAZ === true || (rds.metadata.readReplicaCount as number) > 0
        if (hasReplica) continue

        advisories.push({
          ruleId: 'apigw-lambda-rds-no-guardrails',
          severity: 'critical',
          title: 'Unguarded API→Lambda→RDS chain',
          detail: `API Gateway "${node.label}" routes to Lambda "${lambda.label}" (no timeout) → RDS "${rds.label}" (no read replica). A traffic spike exhausts RDS connections with no circuit breaker.`,
          nodeId: node.id
        })
      }
    }
  }

  // ── Advisory: apigw-lambda-no-concurrency-limit ────────────────────────────
  for (const node of nodes) {
    if (node.type !== 'apigw') continue
    const hasThrottling = node.metadata.throttlingBurstLimit != null

    if (hasThrottling) continue

    const lambdaTargets = (node.integrations ?? [])
      .map((e) => byId.get(e.targetId))
      .filter((n): n is CloudNode => n?.type === 'lambda')

    for (const lambda of lambdaTargets) {
      // Only fire if the scanner actually fetched this field.
      // undefined = scanner didn't call GetFunctionConcurrency (skip — no false positives)
      // null = scanner fetched it, function has no reserved concurrency (fire)
      // number = reserved concurrency is set (skip)
      const reservedConcurrency = lambda.metadata.reservedConcurrentExecutions
      if (reservedConcurrency !== null) continue // undefined or number → skip

      advisories.push({
        ruleId: 'apigw-lambda-no-concurrency-limit',
        severity: 'critical',
        title: 'Unthrottled API with uncapped Lambda concurrency',
        detail: `API Gateway "${node.label}" has no throttling and Lambda "${lambda.label}" has no reserved concurrency limit. A traffic spike can exhaust your entire account's Lambda capacity, taking down all other Lambdas.`,
        nodeId: node.id
      })
    }
  }

  // ── Advisory: lambda-sqs-no-dlq ────────────────────────────────────────────
  for (const node of nodes) {
    if (node.type !== 'lambda') continue

    const sqsTargets = (node.integrations ?? [])
      .map((e) => byId.get(e.targetId))
      .filter((n): n is CloudNode => n?.type === 'sqs')

    for (const sqs of sqsTargets) {
      if (sqs.metadata.hasDlq) continue

      advisories.push({
        ruleId: 'lambda-sqs-no-dlq',
        severity: 'warning',
        title: 'Lambda writes to SQS queue with no dead-letter queue',
        detail: `Lambda "${node.label}" sends to SQS queue "${sqs.label}" which has no DLQ. Failed messages will be silently dropped after maxReceiveCount retries.`,
        nodeId: node.id
      })
    }
  }

  // ── Advisory: sns-sqs-lambda-no-dlq ────────────────────────────────────────
  for (const node of nodes) {
    if (node.type !== 'sns') continue

    const sqsTargets = (node.integrations ?? [])
      .map((e) => byId.get(e.targetId))
      .filter((n): n is CloudNode => n?.type === 'sqs')

    for (const sqs of sqsTargets) {
      if (sqs.metadata.hasDlq) continue

      const lambdaTargets = (sqs.integrations ?? [])
        .map((e) => byId.get(e.targetId))
        .filter((n): n is CloudNode => n?.type === 'lambda')

      for (const lambda of lambdaTargets) {
        advisories.push({
          ruleId: 'sns-sqs-lambda-no-dlq',
          severity: 'warning',
          title: 'SNS fanout chain has no dead-letter protection',
          detail: `SNS topic "${node.label}" → SQS "${sqs.label}" → Lambda "${lambda.label}": no DLQ on the queue. A Lambda processing failure silently loses messages after retries.`,
          nodeId: node.id
        })
      }
    }
  }

  return advisories
}
