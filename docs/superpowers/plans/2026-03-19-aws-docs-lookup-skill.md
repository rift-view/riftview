# AWS Docs Lookup Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a four-file Claude skill at `~/.claude/skills/aws-docs-lookup/` that proactively surfaces authoritative AWS and LocalStack documentation during team meetings and implementation sessions, then push the three public files to a new GitHub repository.

**Architecture:** A `SKILL.md` orchestrator defines triggers and lookup tiers; three sub-files provide Tier 1 embedded knowledge (LocalStack coverage matrix, error codes, IAM patterns); Tier 2 uses deterministic WebFetch to canonical AWS/LocalStack docs URLs; Tier 3 falls back to WebSearch. `localstack-coverage.md` is local-only and never pushed to GitHub.

**Tech Stack:** Markdown skill files, GitHub CLI (`gh`), git.

---

## File Map

| File | Location | Pushed to GitHub |
|---|---|---|
| `SKILL.md` | `~/.claude/skills/aws-docs-lookup/SKILL.md` | ✅ |
| `error-codes.md` | `~/.claude/skills/aws-docs-lookup/error-codes.md` | ✅ |
| `iam-patterns.md` | `~/.claude/skills/aws-docs-lookup/iam-patterns.md` | ✅ |
| `localstack-coverage.md` | `~/.claude/skills/aws-docs-lookup/localstack-coverage.md` | ❌ local only |

---

## Task 1: Create skill directory

**Files:**
- Create: `~/.claude/skills/aws-docs-lookup/` (directory)

- [ ] **Step 1: Create the directory**

```bash
mkdir -p ~/.claude/skills/aws-docs-lookup
```

- [ ] **Step 2: Verify**

```bash
ls ~/.claude/skills/aws-docs-lookup
```
Expected: empty directory, no error.

---

## Task 2: Write `SKILL.md`

**Files:**
- Create: `~/.claude/skills/aws-docs-lookup/SKILL.md`

- [ ] **Step 1: Write the file**

Create `~/.claude/skills/aws-docs-lookup/SKILL.md` with this exact content:

```markdown
---
name: aws-docs-lookup
description: >
  Proactively look up authoritative AWS and LocalStack documentation. Activate
  automatically — without being asked — when ANY of these appear in the conversation:
  (1) AWS error code strings (InvalidClientTokenId, AccessDenied, ThrottlingException,
  DBSubnetGroupNotFoundFault, InvalidAMIID.NotFound, NoSuchBucket, etc.),
  (2) LocalStack coverage questions ("does LocalStack support", "LocalStack Community",
  "LocalStack Pro", "works with LocalStack"),
  (3) IAM or permission questions ("what permissions", "IAM role for", "requires access to"),
  (4) Quota or limit questions ("service limit", "quota", "throttling", "max X per"),
  (5) SDK vs CLI questions ("SDK vs CLI", "CLI flag for", "API reference for"),
  (6) Any Cloudblocks service name (ec2, rds, s3, lambda, vpc, subnet, security-group,
  alb, igw, acm, cloudfront, apigw, sqs, sns, dynamodb, secretsmanager, ecr, ssm,
  nat-gateway, route53, stepfunctions, eventbridge) paired with uncertainty words
  (error, fails, doesn't work, required, supported, invalid, missing).
  During team meetings, validate claims before the team commits. During implementation,
  resolve errors and unknown behaviors against authoritative sources.
---

# AWS & LocalStack Docs Lookup

Proactive reference layer for AWS service knowledge. Three tiers: embedded instant answers,
deterministic doc fetches, search fallback.

## Activation

This skill activates WITHOUT being asked whenever the trigger patterns above appear.
Do not wait for explicit invocation. Surface the lookup result inline.

## Execution: Three-Tier Lookup

### Tier 1 — Read sub-files first (no network, instant)

Select sub-files based on what triggered:

| Trigger type | Sub-file to read |
|---|---|
| Error code string | Read `error-codes.md` (same directory as this file) |
| LocalStack coverage / service support | Read `localstack-coverage.md` (same directory — local only, may not exist) |
| IAM / permissions | Read `iam-patterns.md` (same directory as this file) |
| CLI syntax / SDK question | Skip to Tier 2 directly |

Multiple triggers → read multiple sub-files.
If `localstack-coverage.md` does not exist, skip it and go to Tier 2 for LocalStack questions.
If Tier 1 fully answers the question, **stop here**.

### Tier 2 — Deterministic WebFetch

Construct a canonical URL using the patterns and namespace table below, then fetch with WebFetch.

**URL patterns:**

| Source | Pattern |
|---|---|
| AWS CLI reference | `https://awscli.amazonaws.com/v2/documentation/api/latest/reference/{cli-service}/{command}.html` |
| AWS API reference | `https://docs.aws.amazon.com/{doc-namespace}/latest/APIReference/API_{Operation}.html` |
| AWS developer guide | `https://docs.aws.amazon.com/{doc-namespace}/latest/userguide/` |
| LocalStack coverage | `https://docs.localstack.cloud/references/coverage/coverage_{cli-service}/` |
| LocalStack user guide | `https://docs.localstack.cloud/user-guide/aws/{cli-service}/` |

**Namespace mapping:**

| Service / NodeType | doc-namespace | cli-service |
|---|---|---|
| ec2, vpc, subnet, security-group, igw, nat-gateway | `AWSEC2` | `ec2` |
| rds | `AmazonRDS` | `rds` |
| s3 | `AmazonS3` | `s3api` |
| lambda | `Lambda` | `lambda` |
| cloudfront | `AmazonCloudFront` | `cloudfront` |
| apigw, apigw-route | `apigatewayv2` | `apigatewayv2` |
| sns | `SNS` | `sns` |
| sqs | `SQS` | `sqs` |
| dynamo | `AmazonDynamoDB` | `dynamodb` |
| secret | `SecretsManager` | `secretsmanager` |
| acm | `acm` | `acm` |
| alb | `elasticloadbalancing` | `elbv2` |
| ssm-param | `systems-manager` | `ssm` |
| r53-zone | `Route53` | `route53` |
| sfn | `step-functions` | `stepfunctions` |
| eventbridge-bus | `EventBridge` | `events` |
| ecr-repo | `AmazonECR` | `ecr` |

If WebFetch returns a 404 or empty/irrelevant content, proceed to Tier 3.

### Tier 3 — WebSearch fallback

```
site:docs.aws.amazon.com {service} {topic}
site:docs.localstack.cloud {service}
```

Use for changelog entries, new feature docs, or anything outside standard URL patterns.

## Local-Only File Note

`localstack-coverage.md` is not distributed with this skill. To use LocalStack coverage
lookups offline, create it manually in `~/.claude/skills/aws-docs-lookup/localstack-coverage.md`
with your LocalStack Community/Pro service matrix. If absent, Tier 2 fetches
`docs.localstack.cloud/references/coverage/coverage_{service}/` instead.
```

- [ ] **Step 2: Verify the file exists and has correct frontmatter**

```bash
head -20 ~/.claude/skills/aws-docs-lookup/SKILL.md
```
Expected: frontmatter block starting with `---`, `name: aws-docs-lookup`, multi-line description.

---

## Task 3: Write `error-codes.md`

**Files:**
- Create: `~/.claude/skills/aws-docs-lookup/error-codes.md`

- [ ] **Step 1: Write the file**

Create `~/.claude/skills/aws-docs-lookup/error-codes.md`:

```markdown
# AWS Error Code Reference

Quick-reference for the most common AWS errors in Cloudblocks operations.
Format: **Code** — meaning | most likely cause | fix pattern.

---

## Credential & Auth Errors

**InvalidClientTokenId**
Meaning: The AWS Access Key ID does not exist or is malformed.
Cause in Cloudblocks: Running a CLI command against real AWS with `AWS_ACCESS_KEY_ID=test`
(LocalStack dummy creds leaked to real endpoint). Happens when LocalStack Community doesn't
support the service (e.g., RDS) and the CLI falls through to the real AWS endpoint.
Fix: Use a real AWS profile, or switch to LocalStack Pro for the service.

**ExpiredTokenException**
Meaning: The STS session token has expired.
Cause: Temporary credentials (SSO, assumed role, MFA session) expired mid-session.
Fix: Re-authenticate with `aws sso login` or refresh the credential source.

**AuthFailure**
Meaning: Request signature verification failed.
Cause: System clock skew > 5 minutes, or secret key is wrong.
Fix: Sync system clock (`sudo sntp -sS time.apple.com` on macOS). Verify credentials.

**AccessDenied / AccessDeniedException**
Meaning: The caller does not have the required IAM permission.
Cause: Missing IAM policy action, or resource-based policy denies access.
Fix: Check `iam-patterns.md` for the required action. Add it to the IAM policy.

**NoCredentialProviders**
Meaning: No credential source found in the credential chain.
Cause: No profile configured, no env vars set, no instance role.
Fix: Run `aws configure`, set `AWS_PROFILE`, or attach an instance role.

---

## EC2 / Compute Errors

**InvalidAMIID.NotFound**
Meaning: The specified AMI does not exist in this region.
Cause in Cloudblocks: Using placeholder `ami-12345678` which is not registered in LocalStack
or does not exist in the target region. LocalStack may wrap the ID in brackets in its error.
Fix: On LocalStack, use a pre-registered AMI or run `aws ec2 register-image` first.
On real AWS, look up a current AMI ID for the region from the EC2 console or SSM parameter store.

**InvalidSubnetID.NotFound**
Meaning: Subnet ID does not exist or belongs to another account/region.
Cause: Passing empty string for subnet-id (CLI receives `--subnet-id ''`), or stale ID.
Fix: Guard `--subnet-id` to only include it when non-empty. Verify subnet exists in region.

**InvalidGroup.NotFound**
Meaning: Security group ID does not exist.
Cause: Passing empty or stale security group ID.
Fix: Guard `--security-group-ids` to only include when array is non-empty.

**VpcIdNotFound**
Meaning: VPC ID does not exist in this region/account.
Cause: Stale VPC reference, wrong region, or cross-account access without peering.
Fix: Verify VPC exists with `aws ec2 describe-vpcs`.

**InvalidParameterValue**
Meaning: A parameter value is malformed or out of range.
Cause: Broad — could be invalid instance type, bad CIDR, unsupported engine version.
Fix: Check the AWS CLI reference for the specific operation's parameter constraints.

---

## RDS Errors

**DBSubnetGroupNotFoundFault**
Meaning: No DB subnet group found with the specified name (or default).
Cause: Account has no default DB subnet group (common in newer accounts), or
`--db-subnet-group-name` was not provided.
Fix: Create a DB subnet group first (`aws rds create-db-subnet-group`), then provide
its name in the create command via `--db-subnet-group-name`.

**InvalidVPCNetworkStateFault**
Meaning: DB subnet group does not cover enough AZs.
Cause: Subnet group references subnets in only one AZ; RDS requires at least two.
Fix: Add subnets from a second AZ to the DB subnet group.

---

## S3 Errors

**NoSuchBucket**
Meaning: The specified bucket does not exist.
Cause: Bucket name typo, wrong region, or bucket was deleted.
Fix: Verify with `aws s3api list-buckets`. S3 is global but bucket DNS is region-specific.

**BucketAlreadyExists**
Meaning: Bucket name is taken globally (by any AWS account).
Cause: S3 bucket names are globally unique across all accounts.
Fix: Choose a more unique name (include account ID or random suffix).

**BucketAlreadyOwnedByYou**
Meaning: You already own a bucket with this name.
Cause: Create called twice (e.g., optimistic UI retry), or bucket exists from prior run.
Fix: Treat as success — bucket already exists in your account.

---

## General / Throttling Errors

**ThrottlingException / RequestLimitExceeded**
Meaning: Too many API calls in too short a window.
Cause: Parallel scans hitting rate limits. Common on large accounts with many resources.
Fix: Add exponential backoff, reduce scan parallelism, or use paginated calls with delays.

**RequestExpired**
Meaning: Request timestamp is too old (> 15 minutes from server time).
Cause: System clock skew.
Fix: Sync system clock.

**ResourceNotFoundException**
Meaning: The specified resource does not exist.
Cause: Stale reference (resource was deleted), wrong region, or wrong account.
Fix: Verify resource exists with the appropriate `describe-*` command.

**ServiceUnavailable / InternalFailure**
Meaning: AWS-side transient error.
Cause: AWS service disruption or internal error.
Fix: Retry with exponential backoff. Check AWS Service Health Dashboard.
```

- [ ] **Step 2: Verify line count is reasonable**

```bash
wc -l ~/.claude/skills/aws-docs-lookup/error-codes.md
```
Expected: 80–120 lines.

---

## Task 4: Write `iam-patterns.md`

**Files:**
- Create: `~/.claude/skills/aws-docs-lookup/iam-patterns.md`

- [ ] **Step 1: Write the file**

Create `~/.claude/skills/aws-docs-lookup/iam-patterns.md`:

```markdown
# IAM Permission Patterns for Cloudblocks Operations

Required IAM actions per service operation. "Minimum required" means the operation
will fail with AccessDenied without these. Additional actions may be needed for
tagging, logging, or cross-service integrations.

---

## EC2

| Operation | Required IAM Actions |
|---|---|
| List instances (scan) | `ec2:DescribeInstances` |
| List VPCs (scan) | `ec2:DescribeVpcs` |
| List subnets (scan) | `ec2:DescribeSubnets` |
| List security groups (scan) | `ec2:DescribeSecurityGroups` |
| List key pairs (scan) | `ec2:DescribeKeyPairs` |
| Create instance | `ec2:RunInstances`, `ec2:CreateTags`, `ec2:DescribeImages` |
| Create instance with instance profile | + `iam:PassRole` |
| Create VPC | `ec2:CreateVpc`, `ec2:CreateTags` |
| Create subnet | `ec2:CreateSubnet`, `ec2:CreateTags` |
| Create security group | `ec2:CreateSecurityGroup`, `ec2:AuthorizeSecurityGroupIngress`, `ec2:CreateTags` |
| Delete instance | `ec2:TerminateInstances` |
| Delete VPC | `ec2:DeleteVpc` |
| Delete subnet | `ec2:DeleteSubnet` |
| Delete security group | `ec2:DeleteSecurityGroup` |
| Start/stop instance | `ec2:StartInstances`, `ec2:StopInstances` |
| Create IGW | `ec2:CreateInternetGateway`, `ec2:AttachInternetGateway`, `ec2:CreateTags` |
| Create NAT Gateway | `ec2:CreateNatGateway`, `ec2:AllocateAddress`, `ec2:CreateTags` |

---

## RDS

| Operation | Required IAM Actions |
|---|---|
| List DB instances (scan) | `rds:DescribeDBInstances` |
| Create DB instance | `rds:CreateDBInstance`, `rds:AddTagsToResource` |
| Create DB instance in VPC | + `ec2:DescribeVpcs`, `ec2:DescribeSubnets`, `ec2:DescribeSecurityGroups` |
| Delete DB instance | `rds:DeleteDBInstance` |
| Modify DB instance | `rds:ModifyDBInstance` |

---

## S3

| Operation | Required IAM Actions |
|---|---|
| List buckets (scan) | `s3:ListAllMyBuckets` |
| Create bucket | `s3:CreateBucket` |
| Create bucket (block public access) | + `s3:PutBucketPublicAccessBlock` |
| Delete bucket | `s3:DeleteBucket` |
| Delete bucket (force, with objects) | + `s3:DeleteObject`, `s3:ListBucketVersions`, `s3:DeleteObjectVersion` |

---

## Lambda

| Operation | Required IAM Actions |
|---|---|
| List functions (scan) | `lambda:ListFunctions` |
| Create function | `lambda:CreateFunction`, `iam:PassRole` |
| Create function in VPC | + `ec2:DescribeVpcs`, `ec2:DescribeSubnets`, `ec2:DescribeSecurityGroups`, `ec2:CreateNetworkInterface` |
| Delete function | `lambda:DeleteFunction` |
| Update function code | `lambda:UpdateFunctionCode` |
| Update function config | `lambda:UpdateFunctionConfiguration` |

---

## ALB / ELBv2

| Operation | Required IAM Actions |
|---|---|
| List load balancers (scan) | `elasticloadbalancing:DescribeLoadBalancers` |
| Create load balancer | `elasticloadbalancing:CreateLoadBalancer`, `ec2:DescribeSubnets`, `ec2:DescribeSecurityGroups` |
| Delete load balancer | `elasticloadbalancing:DeleteLoadBalancer` |

---

## CloudFront

| Operation | Required IAM Actions |
|---|---|
| List distributions (scan) | `cloudfront:ListDistributions` |
| Create distribution | `cloudfront:CreateDistribution` |
| Update distribution | `cloudfront:GetDistributionConfig`, `cloudfront:UpdateDistribution` |
| Delete distribution | `cloudfront:GetDistributionConfig`, `cloudfront:UpdateDistribution`, `cloudfront:DeleteDistribution` |
| Create invalidation | `cloudfront:CreateInvalidation` |
| Attach ACM cert to CF | + `acm:ListCertificates`, `acm:DescribeCertificate` |

---

## API Gateway v2

| Operation | Required IAM Actions |
|---|---|
| List APIs (scan) | `apigateway:GET` on `arn:aws:apigateway:*::/apis` |
| List routes (scan) | `apigateway:GET` on `arn:aws:apigateway:*::/apis/*/routes` |
| Create API | `apigateway:POST` on `arn:aws:apigateway:*::/apis` |
| Create route | `apigateway:POST` on `arn:aws:apigateway:*::/apis/*/routes` |
| Delete API | `apigateway:DELETE` on `arn:aws:apigateway:*::/apis/*` |

---

## SNS

| Operation | Required IAM Actions |
|---|---|
| List topics (scan) | `sns:ListTopics` |
| List subscriptions (scan) | `sns:ListSubscriptionsByTopic` |
| Create topic | `sns:CreateTopic` |
| Delete topic | `sns:DeleteTopic` |
| Subscribe (Lambda) | `sns:Subscribe`, `lambda:AddPermission` |

---

## SQS

| Operation | Required IAM Actions |
|---|---|
| List queues (scan) | `sqs:ListQueues` |
| Create queue | `sqs:CreateQueue` |
| Delete queue | `sqs:DeleteQueue` |

---

## DynamoDB

| Operation | Required IAM Actions |
|---|---|
| List tables (scan) | `dynamodb:ListTables` |
| Create table | `dynamodb:CreateTable` |
| Delete table | `dynamodb:DeleteTable` |

---

## Secrets Manager

| Operation | Required IAM Actions |
|---|---|
| List secrets (scan) | `secretsmanager:ListSecrets` |
| Get secret value | `secretsmanager:GetSecretValue` |
| Create secret | `secretsmanager:CreateSecret` |
| Delete secret | `secretsmanager:DeleteSecret` |

---

## ACM

| Operation | Required IAM Actions |
|---|---|
| List certificates (scan) | `acm:ListCertificates`, `acm:DescribeCertificate` |
| Request certificate | `acm:RequestCertificate` |
| Delete certificate | `acm:DeleteCertificate` |

---

## ECR

| Operation | Required IAM Actions |
|---|---|
| List repositories (scan) | `ecr:DescribeRepositories` |
| Create repository | `ecr:CreateRepository` |
| Delete repository | `ecr:DeleteRepository` |
| Push image | `ecr:GetAuthorizationToken`, `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload` |

---

## SSM Parameter Store

| Operation | Required IAM Actions |
|---|---|
| List parameters (scan) | `ssm:DescribeParameters` |
| Get parameter value | `ssm:GetParameter`, `ssm:GetParameters` |
| Create parameter | `ssm:PutParameter` |
| Delete parameter | `ssm:DeleteParameter` |

---

## Route 53

| Operation | Required IAM Actions |
|---|---|
| List hosted zones (scan) | `route53:ListHostedZones` |
| Create hosted zone | `route53:CreateHostedZone` |
| Delete hosted zone | `route53:DeleteHostedZone` |
| Manage records | `route53:ChangeResourceRecordSets` |

---

## Step Functions

| Operation | Required IAM Actions |
|---|---|
| List state machines (scan) | `states:ListStateMachines` |
| Create state machine | `states:CreateStateMachine`, `iam:PassRole` |
| Delete state machine | `states:DeleteStateMachine` |
| Start execution | `states:StartExecution` |

---

## EventBridge

| Operation | Required IAM Actions |
|---|---|
| List event buses (scan) | `events:ListEventBuses` |
| Create event bus | `events:CreateEventBus` |
| Delete event bus | `events:DeleteEventBus` |
| Put rule | `events:PutRule`, `events:PutTargets` |

---

## Minimum Cloudblocks Read-Only Scan Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "ec2:DescribeInstances", "ec2:DescribeVpcs", "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups", "ec2:DescribeKeyPairs",
      "ec2:DescribeInternetGateways", "ec2:DescribeNatGateways",
      "rds:DescribeDBInstances",
      "s3:ListAllMyBuckets",
      "lambda:ListFunctions",
      "elasticloadbalancing:DescribeLoadBalancers",
      "cloudfront:ListDistributions",
      "apigateway:GET",
      "sns:ListTopics", "sns:ListSubscriptionsByTopic",
      "sqs:ListQueues",
      "dynamodb:ListTables",
      "secretsmanager:ListSecrets",
      "acm:ListCertificates", "acm:DescribeCertificate",
      "ecr:DescribeRepositories",
      "ssm:DescribeParameters",
      "route53:ListHostedZones",
      "states:ListStateMachines",
      "events:ListEventBuses"
    ],
    "Resource": "*"
  }]
}
```
```

- [ ] **Step 2: Verify line count**

```bash
wc -l ~/.claude/skills/aws-docs-lookup/iam-patterns.md
```
Expected: 150–220 lines.

---

## Task 5: Write `localstack-coverage.md` (local only)

**Files:**
- Create: `~/.claude/skills/aws-docs-lookup/localstack-coverage.md`

- [ ] **Step 1: Write the file**

Create `~/.claude/skills/aws-docs-lookup/localstack-coverage.md`:

```markdown
# LocalStack Service Coverage Matrix

**THIS FILE IS LOCAL ONLY — do not push to GitHub.**

Community = LocalStack Community (free, open source)
Pro = LocalStack Pro (paid) only

Last verified: 2026-03-19. Check docs.localstack.cloud for updates.

---

## Coverage by Cloudblocks Service

| NodeType | Community | Pro | Key Divergences from Real AWS |
|---|---|---|---|
| ec2 | ✅ | ✅ | AMIs must be pre-registered (`aws ec2 register-image`). `ami-12345678` placeholder does NOT work — use `ami-00000000` or register first. Key pairs accepted but SSH not functional. |
| vpc | ✅ | ✅ | Near-full parity. Default VPC created automatically. |
| subnet | ✅ | ✅ | Near-full parity. AZ names are synthetic (us-east-1a etc. accepted). |
| security-group | ✅ | ✅ | Rules accepted but not enforced — traffic not actually filtered. |
| igw | ✅ | ✅ | Accepted but internet routing is not real. |
| nat-gateway | ✅ | ✅ | Created successfully; no real NAT behavior. |
| rds | ❌ | ✅ | **Not in Community.** CLI with `--endpoint-url localhost:4566` silently falls through to real `rds.amazonaws.com`, causing `InvalidClientTokenId` with dummy creds. Gate this in CliEngine. |
| s3 | ✅ | ✅ | Path-style URLs only (`localhost:4566/bucket`), not virtual-hosted (`bucket.s3.amazonaws.com`). Presigned URLs work but use localhost domain. ACLs partially supported. |
| lambda | ✅ | ✅ | Cold starts simulated. Layers limited in Community. Container images require Pro. |
| alb | ⚠️ | ✅ | Community: basic creation only, no real load balancing. Target group routing not functional. |
| cloudfront | ❌ | ✅ | **Not in Community.** Returns 501 or routes to real AWS. |
| acm | ❌ | ✅ | **Not in Community.** Certificate request accepted but validation never completes. |
| apigw | ✅ | ✅ | HTTP API (v2) supported. Invoke URLs use `localhost:4566`. Lambda integrations work. |
| apigw-route | ✅ | ✅ | Routes created and invoke correctly against local Lambda. |
| sns | ✅ | ✅ | HTTP/HTTPS subscriptions work against localhost. Email subscriptions accepted but not delivered. SQS subscriptions work. Lambda subscriptions work. |
| sqs | ✅ | ✅ | Standard and FIFO queues. Near-full parity. Dead-letter queues supported. |
| dynamo | ✅ | ✅ | Near-full parity. Global tables (v2) require Pro. |
| secret | ✅ | ✅ | Secrets stored and retrieved. Rotation lambda trigger not invoked in Community. |
| ecr-repo | ✅ | ✅ | Repositories created. Docker push/pull requires Pro for full registry behavior. |
| ssm-param | ✅ | ✅ | Standard parameters. SecureString uses local encryption (not real KMS). |
| r53-zone | ⚠️ | ✅ | Community: zones created but DNS not resolvable. Pro: Route53 Resolver works. |
| sfn | ✅ | ✅ | State machines execute locally. Activity workers and callbacks supported. |
| eventbridge-bus | ✅ | ✅ | Custom event buses and rules work. Cross-account targets not supported. |

---

## Common LocalStack-Specific Behaviors

### Credential injection
Always use `AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test` with `--endpoint-url`.
LocalStack accepts any non-empty credential pair. Region must be set but value is ignored.

### AMI registration (EC2)
LocalStack does not pre-populate any AMIs. To use `run-instances`:
```bash
aws --endpoint-url=http://localhost:4566 ec2 register-image \
  --name "my-ami" --root-device-name "/dev/sda1" \
  --block-device-mappings DeviceName=/dev/sda1,Ebs={VolumeSize=8}
# Returns: { "ImageId": "ami-xxxxxxxx" }
# Use the returned ImageId in run-instances
```

### S3 path-style access
LocalStack only supports path-style URLs. The AWS SDK defaults to virtual-hosted style.
Force path-style with: `aws configure set default.s3.addressing_style path`
Or in SDK: `forcePathStyle: true` in client config.

### Port
Default LocalStack port: `4566` (all services on one port).
Edge service URL: `http://localhost:4566`

### Versions
LocalStack Community: github.com/localstack/localstack
LocalStack Pro: app.localstack.cloud
CLI: `pip install localstack` or `brew install localstack`
```

- [ ] **Step 2: Verify the file is NOT in any git repo**

```bash
cd ~/.claude/skills/aws-docs-lookup && git status 2>&1 || echo "Not a git repo — correct"
```
Expected: "Not a git repo — correct" (this directory will become a git repo in Task 6, but `localstack-coverage.md` must be gitignored before then).

---

## Task 6: Initialize git repo and set up `.gitignore`

**Files:**
- Create: `~/.claude/skills/aws-docs-lookup/.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd ~/.claude/skills/aws-docs-lookup && git init
```

- [ ] **Step 2: Create `.gitignore` to exclude `localstack-coverage.md`**

Create `~/.claude/skills/aws-docs-lookup/.gitignore`:

```
localstack-coverage.md
```

- [ ] **Step 3: Verify gitignore works**

```bash
cd ~/.claude/skills/aws-docs-lookup && git status
```
Expected output should show `SKILL.md`, `error-codes.md`, `iam-patterns.md`, `.gitignore` as untracked — but NOT `localstack-coverage.md`.

- [ ] **Step 4: Stage and commit the three public files**

```bash
cd ~/.claude/skills/aws-docs-lookup
git add SKILL.md error-codes.md iam-patterns.md .gitignore
git commit -m "feat: initial aws-docs-lookup skill"
```

---

## Task 7: Create GitHub repository and push

- [ ] **Step 1: Verify `gh` CLI is authenticated**

```bash
gh auth status
```
Expected: logged in to github.com.

- [ ] **Step 2: Create public GitHub repository**

```bash
cd ~/.claude/skills/aws-docs-lookup
gh repo create aws-docs-lookup --public --description "Proactive AWS & LocalStack documentation lookup skill for Claude" --source=. --remote=origin --push
```
Expected: repository created at `github.com/<username>/aws-docs-lookup`, files pushed.

- [ ] **Step 3: Verify `localstack-coverage.md` is NOT on GitHub**

```bash
gh api repos/$(gh api user --jq .login)/aws-docs-lookup/contents/ --jq '.[].name'
```
Expected output contains: `SKILL.md`, `error-codes.md`, `iam-patterns.md`, `.gitignore`
Must NOT contain: `localstack-coverage.md`

- [ ] **Step 4: Confirm the repo URL**

```bash
gh repo view aws-docs-lookup --web 2>/dev/null || gh repo view $(gh api user --jq .login)/aws-docs-lookup
```

---

## Task 8: Smoke test skill activation

- [ ] **Step 1: Verify all four files exist locally**

```bash
ls -la ~/.claude/skills/aws-docs-lookup/
```
Expected: `SKILL.md`, `error-codes.md`, `iam-patterns.md`, `localstack-coverage.md`, `.gitignore`

- [ ] **Step 2: Verify skill is visible to Claude Code**

```bash
ls ~/.claude/skills/
```
Expected: `aws-docs-lookup` appears alongside other skill directories.

- [ ] **Step 3: Spot-check key content**

```bash
grep -l "InvalidClientTokenId" ~/.claude/skills/aws-docs-lookup/error-codes.md && echo "error-codes OK"
grep -l "rds:CreateDBInstance" ~/.claude/skills/aws-docs-lookup/iam-patterns.md && echo "iam-patterns OK"
grep -l "LocalStack Community" ~/.claude/skills/aws-docs-lookup/localstack-coverage.md && echo "localstack-coverage OK"
grep -l "aws-docs-lookup" ~/.claude/skills/aws-docs-lookup/SKILL.md && echo "SKILL.md OK"
```
Expected: all four lines print "OK".
