# AWS & LocalStack Docs Lookup Skill

**Date:** 2026-03-19
**Status:** Approved — ready for implementation

---

## 1. Purpose

A proactive Claude skill that surfaces authoritative AWS and LocalStack documentation during team meetings and implementation sessions. It fires without explicit invocation — triggering on error codes, service coverage questions, IAM/permission questions, and service-plus-uncertainty patterns — and resolves them through a three-tier lookup strategy before the team proceeds on memory alone.

The RDS `InvalidClientTokenId` miss (LocalStack Community doesn't support RDS, CLI bled to real AWS) is the canonical motivating case: Tier 1 of this skill would have caught it instantly.

---

## 2. Scope

The skill covers:
- LocalStack Community vs Pro service coverage and behavioral divergences from real AWS
- AWS error codes — meaning, likely cause in a Cloudblocks context, fix pattern
- IAM permission requirements per service operation (create, list, delete)
- AWS service limits and quotas
- AWS CLI command syntax and flags
- SDK vs CLI behavioral differences
- Region and availability zone constraints

Services covered: all 24 Cloudblocks `NodeType` services (EC2, VPC, Subnet, SG, RDS, S3, Lambda, ALB, IGW, ACM, CloudFront, API Gateway, API Gateway Route, SQS, Secrets Manager, ECR, SNS, DynamoDB, SSM Parameter, NAT Gateway, Route53, SFN, EventBridge, ECS).

---

## 3. File Structure

```
~/.claude/skills/aws-docs-lookup/
  SKILL.md                 # Trigger rules, Tier 2 URL patterns, Tier 3 instructions,
                           # instructions for loading sub-files
  localstack-coverage.md   # Tier 1: Community vs Pro matrix + behavioral divergences
                           # LOCAL ONLY — not pushed to GitHub
  error-codes.md           # Tier 1: ~20 common error codes, meaning, cause, fix
  iam-patterns.md          # Tier 1: Per-service IAM action requirements
```

`SKILL.md` instructs Claude to read the relevant sub-file first before attempting any network fetch. Sub-files are loaded on demand — only the one relevant to the current question.

---

## 4. Trigger Conditions

The skill activates proactively when any of the following appear:

| Pattern | Examples |
|---|---|
| AWS error code strings | `InvalidClientTokenId`, `DBSubnetGroupNotFoundFault`, `InvalidAMIID.NotFound`, `AccessDenied`, `ThrottlingException` |
| LocalStack coverage questions | "does LocalStack support", "LocalStack Community", "LocalStack Pro", "works with LocalStack" |
| IAM / permission questions | "what permissions", "IAM role for", "requires access to", "policy for X" |
| Quota / limit questions | "service limit", "quota", "throttling", "max X per" |
| SDK vs CLI questions | "SDK vs CLI", "CLI flag for", "API reference for" |
| Service + uncertainty | Any of the 24 service names paired with "error", "fails", "doesn't work", "required", "supported" |

During team meetings, the skill surfaces lookups inline — Cloud Architect or Backend Engineer makes a claim, the skill validates or corrects it before the team commits.

---

## 5. Three-Tier Lookup Strategy

### Tier 1 — Embedded (instant, no network)

Read the relevant sub-file and answer from it:

- **`localstack-coverage.md`**: Community/Pro matrix for all 24 services; known divergences from real AWS (AMI registration requirements, S3 path-style URLs, CloudFront not in Community, RDS not in Community, etc.)
- **`error-codes.md`**: ~20 error codes with meaning, most likely cause in Cloudblocks context, and fix pattern
- **`iam-patterns.md`**: Per-service IAM action requirements for every operation Cloudblocks performs

If Tier 1 covers the question, stop here.

### Tier 2 — Deterministic WebFetch

Construct a canonical URL from known patterns and fetch:

| Source | URL Pattern |
|---|---|
| AWS CLI reference | `https://awscli.amazonaws.com/v2/documentation/api/latest/reference/{service}/{command}.html` |
| AWS API reference | `https://docs.aws.amazon.com/{service}/latest/APIReference/API_{Operation}.html` |
| AWS developer guide | `https://docs.aws.amazon.com/{service}/latest/userguide/` |
| LocalStack coverage | `https://docs.localstack.cloud/references/coverage/coverage_{service}/` |
| LocalStack user guide | `https://docs.localstack.cloud/user-guide/aws/{service}/` |

The skill includes a service-name namespace mapping:

| Cloudblocks type | AWS doc namespace | CLI service name |
|---|---|---|
| ec2, vpc, subnet, sg | `AWSEC2` | `ec2` |
| rds | `AmazonRDS` | `rds` |
| s3 | `AmazonS3` | `s3api` / `s3` |
| lambda | `Lambda` | `lambda` |
| cloudfront | `AmazonCloudFront` | `cloudfront` |
| apigw | `apigatewayv2` | `apigatewayv2` |
| sns | `SNS` | `sns` |
| sqs | `SQS` | `sqs` |
| dynamo | `AmazonDynamoDB` | `dynamodb` |
| secret | `SecretsManager` | `secretsmanager` |
| acm | `acm` | `acm` |
| alb | `elasticloadbalancing` | `elbv2` |
| ssm-param | `systems-manager` | `ssm` |
| nat-gateway | `AWSEC2` | `ec2` |
| r53-zone | `Route53` | `route53` |
| sfn | `step-functions` | `stepfunctions` |
| eventbridge-bus | `EventBridge` | `events` |
| ecr-repo | `AmazonECR` | `ecr` |
| igw | `AWSEC2` | `ec2` |

### Tier 3 — WebSearch fallback

When Tier 2 returns a 404 or insufficient content, fall back to a structured search:

```
site:docs.aws.amazon.com {service} {topic}
site:docs.localstack.cloud {service}
```

Used for changelog entries, new feature docs, or anything outside standard URL patterns.

---

## 6. GitHub Distribution

Three files are pushed to a public GitHub repository for sharing:
- `SKILL.md`
- `error-codes.md`
- `iam-patterns.md`

`localstack-coverage.md` is **local only** — not committed to the repository. The `SKILL.md` notes that this file is optional and must be created locally.

---

## 7. Integration with Cloudblocks Team

The skill description is written so the `using-superpowers` system recognizes it during:
- Team meetings (proactive lookup when agents make service/coverage claims)
- Implementation sessions (automatic lookup when error codes appear in logs or CLI output)
- Brainstorming (validates architecture assumptions before they become plans)

The skill does not replace team agent judgment — it provides a fast reference layer so agents reason from facts, not training-data approximations.

---

## 8. Implementation Checklist

- [ ] Write `SKILL.md` with trigger rules, Tier 2 URL patterns, Tier 3 instructions, sub-file loading instructions
- [ ] Write `localstack-coverage.md` — full 24-service Community/Pro matrix with divergence notes
- [ ] Write `error-codes.md` — ~20 error codes with meaning, cause, fix
- [ ] Write `iam-patterns.md` — per-service IAM action requirements for all Cloudblocks operations
- [ ] Test skill activation: error code trigger, LocalStack coverage question, IAM question
- [ ] Create GitHub repository for the skill
- [ ] Push `SKILL.md`, `error-codes.md`, `iam-patterns.md` to GitHub
- [ ] Confirm `localstack-coverage.md` is not in the push
