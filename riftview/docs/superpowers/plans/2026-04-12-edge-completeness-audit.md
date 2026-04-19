# Edge Completeness Audit
Date: 2026-04-12

## Summary
- **18 edges currently detected** across all scanners
- **6 edges missing** (2 High priority, 2 Medium, 2 Low)

---

## Currently Detected

| Edge | How detected | Scanner file |
|---|---|---|
| SNS → SQS | SNS scanner: `ListSubscriptionsByTopicCommand` — endpoint ARN added as `subscription` integration on SNS node; SQS node ID is its queue ARN | `sns.ts` |
| SNS → Lambda | Same subscription scan — Lambda ARN endpoints are captured as `subscription` integrations on SNS node | `sns.ts` |
| SQS → Lambda | SQS scanner: `ListEventSourceMappingsCommand` (by queue ARN) — Lambda ARN added as `trigger` integration on SQS node | `sqs.ts` |
| DynamoDB Streams → Lambda | DynamoDB scanner: `DescribeTableCommand` gives `LatestStreamArn`, then `ListEventSourceMappingsCommand` — Lambda ARN added as `trigger` integration on DynamoDB node | `dynamo.ts` |
| Kinesis → Lambda | Lambda scanner: `ListEventSourceMappingsCommand` — Kinesis ARN added as `trigger` integration on Lambda node (source side); Lambda node ID is its ARN | `lambda.ts` |
| EventBridge → Lambda | EventBridge scanner: `ListTargetsByRuleCommand` — Lambda ARN captured if starts with `arn:aws:lambda:` | `eventbridge.ts` |
| EventBridge → SQS | EventBridge scanner: same target list — SQS ARN captured if starts with `arn:aws:sqs:` | `eventbridge.ts` |
| EventBridge → SNS | EventBridge scanner: same target list — SNS ARN captured if starts with `arn:aws:sns:` | `eventbridge.ts` |
| EventBridge → SFN | EventBridge scanner: same target list — SFN ARN captured if starts with `arn:aws:states:` | `eventbridge.ts` |
| S3 → Lambda | S3 scanner: `GetBucketNotificationConfigurationCommand` — `LambdaFunctionConfigurations[].LambdaFunctionArn` added as `trigger` | `s3.ts` |
| S3 → SQS | S3 scanner: same notification config — `QueueConfigurations[].QueueArn` added as `trigger` | `s3.ts` |
| S3 → SNS | S3 scanner: same notification config — `TopicConfigurations[].TopicArn` added as `trigger` | `s3.ts` |
| API Gateway → Lambda | APIGW scanner: `GetIntegrationsCommand` resolves `AWS_PROXY` integration URI to Lambda ARN; aggregated as `trigger` on both the route node and the parent API node | `apigw.ts` |
| APIGW → Cognito | APIGW scanner: `GetAuthorizersCommand` — Cognito user pool ID extracted from JWT issuer URL and added as `trigger` on API node | `apigw.ts` |
| CloudFront → S3 | CloudFront scanner: origin domain name matched via regex `\.s3[.-]` — bucket name extracted and added as `origin` integration | `cloudfront.ts` |
| CloudFront → ALB | CloudFront scanner: origin domain name matched via `\.elb\.amazonaws\.com$` — raw DNS name stored; `resolveIntegrationTargetId` then matches it against `alb.metadata.dnsName` | `cloudfront.ts` + `resolveIntegrationTargetId.ts` |
| CloudFront → API Gateway | CloudFront scanner: origin domain name matched via `\.execute-api\.[^.]+\.amazonaws\.com$` — hostname stored; resolver matches against `apigw.metadata.endpoint` URL | `cloudfront.ts` + `resolveIntegrationTargetId.ts` |
| ALB → Lambda | ALB scanner: `DescribeTargetHealthCommand` — target ID starting with `arn:aws:lambda:` added as `trigger` | `alb.ts` |
| ALB → EC2 | ALB scanner: same health check — target ID starting with `i-` added as `origin` (EC2 instance IDs) | `alb.ts` |
| ECS → ALB | ECS scanner: `svc.loadBalancers[].targetGroupArn` added as `origin`; `resolveIntegrationTargetId` matches target group ARN against `alb.metadata.targetGroupArns[]` | `ecs.ts` + `resolveIntegrationTargetId.ts` |
| ECS → ECR | ECS scanner: `DescribeTaskDefinitionCommand` — container image URI matched against `*.dkr.ecr.*` pattern, repo URI added as `origin` | `ecs.ts` |
| SFN → Lambda | SFN scanner: `DescribeStateMachineCommand` parses state machine definition JSON — `Resource` ARNs and `Parameters.FunctionName` ARNs starting with `arn:aws:lambda:` captured as `trigger` | `sfn.ts` |
| SFN → SQS | SFN scanner: same definition parse — `Resource` ARNs starting with `arn:aws:sqs:` captured as `trigger` | `sfn.ts` |
| SFN → SNS | SFN scanner: same definition parse — `Resource` ARNs starting with `arn:aws:sns:` captured | `sfn.ts` |
| SFN → DynamoDB | SFN scanner: definition parse — SDK integration resources like `arn:aws:states:::dynamodb:putItem` matched; `Parameters.TableName` extracted as `trigger` | `sfn.ts` |
| SFN → S3 | SFN scanner: definition parse — `arn:aws:states:::s3:*` resources matched; `Parameters.Bucket` extracted as `trigger` | `sfn.ts` |
| Lambda env-var → SQS/SNS/Secrets/SFN/EventBridge/Kinesis | Lambda scanner: `GetFunctionConfigurationCommand` — env var values matching ARN prefixes for these services added as `trigger` integrations | `lambda.ts` |
| Lambda env-var → DynamoDB | Lambda scanner: env var ARN `arn:aws:dynamodb:...:table/TableName` — table name extracted and added as `trigger` | `lambda.ts` |
| Lambda env-var → S3 | Lambda scanner: env var ARN `arn:aws:s3:::bucket-name` — bucket name extracted and added as `trigger` | `lambda.ts` |
| Lambda env-var → RDS | Lambda scanner: env var value matching `*.rds.amazonaws.com` hostname — added as `trigger`; resolved in `resolveIntegrationTargetId` via `rds.metadata.endpoint` | `lambda.ts` |
| Lambda env-var → SES | Lambda scanner: env var value matching email address pattern — added as `trigger`; matches SES node ID (email identity) | `lambda.ts` |
| Lambda env-var → OpenSearch | Lambda scanner: env var value matching `*.es.amazonaws.com` or `*.aoss.amazonaws.com` — host extracted and added as `trigger`; resolved via `opensearch.metadata.endpoint` | `lambda.ts` |
| Lambda env-var → ElastiCache | Lambda scanner: env var value matching `*.cache.amazonaws.com` — added as `trigger`; resolved via `elasticache.metadata.endpoint` | `lambda.ts` |
| CloudFront → ACM | CloudFront scanner: `ViewerCertificate.ACMCertificateArn` added as `origin` | `cloudfront.ts` |
| ALB → ACM | ALB scanner: `DescribeListenersCommand` — HTTPS listener certificate ARNs added as `origin` | `alb.ts` |

---

## Missing Edges

### High Priority

| Edge | API field needed | Difficulty | Notes |
|---|---|---|---|
| ALB → ECS | `DescribeTargetGroups` returns `TargetType`; when `TargetType == 'ip'` the ECS task IPs are targets, but the meaningful link is ALB ↔ ECS *service* — already bridged via the ECS side (`ECS → ALB` is detected). The reverse direction (ALB node pointing *to* ECS) is **not** emitted. The edge exists but is unidirectional: only the ECS node has the integration, not the ALB node. For blast radius, a blast starting at ALB won't propagate to ECS. | `alb.metadata.targetGroupArns[]` already stored; ECS nodes already carry the corresponding target group ARNs in their integrations. A reverse lookup in `resolveIntegrationTargetId` or a second pass in the edge builder would close this. | **Easy** — data already on both sides, just needs a second-pass edge builder that walks `alb.metadata.targetGroupArns` and joins to `ecs.integrations[].targetId` | The ECS → ALB edge renders correctly today. The gap is only in blast radius propagation direction from ALB. |
| Lambda ← Kinesis (Kinesis node side) | `ListEventSourceMappingsCommand` (by Kinesis stream ARN) | **Easy** — already called from Lambda's side (Lambda node stores Kinesis ARN as `trigger`). Kinesis scanner (`kinesis.ts`) never calls `ListEventSourceMappingsCommand` so the Kinesis node carries no integrations. For blast radius starting at Kinesis, the edge won't be traversed. The edge does render (Lambda → Kinesis direction), but Kinesis→Lambda propagation fails. | Kinesis scanner needs `ListEventSourceMappingsCommand({ EventSourceArn: streamArn })` — identical pattern to `dynamo.ts`. One extra API call per stream. |

### Medium Priority

| Edge | API field needed | Difficulty | Notes |
|---|---|---|---|
| EventBridge → ECS (task/service target) | `ListTargetsByRuleCommand` — target ARN `arn:aws:ecs:` prefix | **Easy** — already fetching all targets; `ALLOWED_TARGET_PREFIXES` in `eventbridge.ts` just needs `'arn:aws:ecs:'` added. The ECS service ARN is a valid node ID. Uncommon pattern but used with ECS task scheduling. | Add `'arn:aws:ecs:'` to `ALLOWED_TARGET_PREFIXES` and ensure `ecs` node ID (service ARN) is used. |
| MSK → Lambda | MSK trigger: `ListEventSourceMappingsCommand({ EventSourceArn: clusterArn })` | **Medium** — Lambda scanner already handles `arn:aws:kafka:` prefixed ESMs (line 87 in `lambda.ts`), so Lambda nodes already emit MSK ARN as `trigger`. The gap is the reverse direction (MSK node has no integrations emitted). MSK scanner (`msk.ts`) needs a check similar to kinesis/dynamo. Requires reading the MSK scanner to verify. | Check `msk.ts` to confirm it doesn't call `ListEventSourceMappingsCommand`. If confirmed missing, add the same pattern. |

### Low Priority

| Edge | API field needed | Difficulty | Notes |
|---|---|---|---|
| ECS → RDS (VPC/SG inference) | No direct API field — would require comparing VPC ID + security group overlap between ECS task and RDS instance | **Hard** — inference from VPC topology and security group rules. Prone to false positives. No authoritative "this ECS task connects to this RDS" API exists. Skip for blast radius v1. | Recommend skipping; surface as an advisory ("ECS and RDS share a security group") rather than an edge. |
| ECS → DynamoDB (IAM role) | `iam:ListRolePolicies` + `iam:GetPolicy` on the task execution role | **Hard** — requires IAM read permission and multi-call chain: ECS service → task definition → task role ARN → IAM policy → resource ARNs. Fragile and permission-sensitive. | Skip for v1. |

---

## Recommended First Wave (for blast radius v1)

Four edges to close before shipping blast radius UI, in implementation order:

1. **Kinesis → Lambda (Kinesis node side)** — `kinesis.ts`: add `ListEventSourceMappingsCommand({ EventSourceArn: streamArn })` loop, emit `trigger` integrations on the Kinesis node. Identical pattern to `dynamo.ts` lines 45–55. One new SDK import, ~10 lines.

2. **ALB → ECS (reverse direction)** — No new API calls needed. Options:
   - Option A: In the edge builder (`TopologyView.tsx`), after emitting all `node.integrations` edges, do a second pass: for each `alb` node, walk its `metadata.targetGroupArns[]` and find any `ecs` node whose `integrations[]` contains that target group ARN, then emit an `alb → ecs` edge.
   - Option B: In `ecs.ts`, after resolving the target group ARN to an ALB, also push a reverse integration onto the ECS node pointing at the ALB node ID (needs `resolveIntegrationTargetId` logic at scan time, which is awkward since node IDs aren't known until all scanners complete).
   - **Recommend Option A** — pure renderer logic, no scanner changes.

3. **EventBridge → ECS** — `eventbridge.ts`: add `'arn:aws:ecs:'` to `ALLOWED_TARGET_PREFIXES`. One line change.

4. **MSK → Lambda** — `msk.ts`: audit the file (not read yet), then add `ListEventSourceMappingsCommand` per cluster ARN if missing, emit `trigger` integrations. Same pattern as kinesis fix.

After these four, blast radius can traverse all high-frequency event-driven patterns with confidence. The two "Hard" edges (ECS→RDS via SG, ECS→DynamoDB via IAM) are better served as advisory rules than graph edges.
