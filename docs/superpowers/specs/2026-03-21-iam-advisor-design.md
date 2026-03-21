# IAM Least-Privilege Advisor — Design Spec

**Date:** 2026-03-21
**Status:** Team-approved (autonomous session)
**Pillar:** Post-1.0 #3

---

## Goal

When a user selects an EC2, Lambda, or S3 resource in the Inspector, Cloudblocks fetches the attached IAM policies on-demand and evaluates them against a severity ruleset. Findings are displayed in a new "IAM Advisor" section with critical/warning/info badges and expandable policy statement details.

---

## Decisions

| Question | Decision |
|----------|----------|
| Fetch timing | On-demand (Inspector open) — not during scan |
| v1 resource scope | EC2 (instance profile role), Lambda (execution role), S3 (bucket policy) |
| Evaluation | Pure `evaluatePolicy()` function — no AWS calls |
| Severity levels | critical, warning, info |
| Missing permissions | Explicit error message in Inspector, not a spinner |
| Timeout | 10 seconds per IAM analysis call |
| Section visibility | Hidden for unsupported node types — no "not supported" label |

---

## Architecture

```
User selects node in Inspector
  → Inspector detects node.type in ['ec2', 'lambda', 's3']
  → IAM section renders with loading state
  → window.cloudblocks.analyzeIam(nodeId, nodeType) IPC call
    → main process: fetchIamData(node) → raw policy documents
    → sanitize: URL-decode encoded policy strings
    → evaluatePolicy(policyDoc): IamFinding[]
    → return IamFinding[]
  → Inspector renders findings
```

---

## Data Types

```typescript
// src/renderer/types/iam.ts (new file)

export type IamSeverity = 'critical' | 'warning' | 'info'

export interface IamFinding {
  severity: IamSeverity
  title: string               // short description: "AdministratorAccess policy attached"
  detail: string              // one-line explanation
  policyName?: string         // which policy triggered this
  statement?: string          // JSON.stringify of the offending statement (for expand)
}

export interface IamAnalysisResult {
  nodeId: string
  findings: IamFinding[]
  error?: string              // set if fetch failed — missing perms, timeout, etc.
  fetchedAt: number           // Date.now() — for "re-check" staleness display
}
```

---

## IAM Fetchers (`src/main/aws/iam/`)

Three fetchers, one per resource type in v1:

### `fetchEc2IamData(node: CloudNode, clients: AwsClients): Promise<PolicyDocument[]>`
1. `ec2.describeInstances` → get `IamInstanceProfile.Arn`
2. Extract role name from instance profile ARN
3. `iam.listAttachedRolePolicies(roleName)` → managed policy ARN list
4. For each managed policy: `iam.getPolicy` → get default version ID → `iam.getPolicyVersion` → get document
5. `iam.listRolePolicies(roleName)` → inline policy names
6. For each inline: `iam.getRolePolicy(roleName, policyName)` → get document
7. URL-decode all policy documents before returning

### `fetchLambdaIamData(node: CloudNode, clients: AwsClients): Promise<PolicyDocument[]>`
1. `node.metadata.role` → role ARN → extract role name

**Note on `node.metadata.role` availability:** The Lambda scanner in `src/main/aws/services/lambda.ts` must include the execution role ARN in the node's metadata. Verify the Lambda service scanner returns `Role` from `GetFunctionConfiguration` / `ListFunctions`. If not currently included, add `role: fn.Role` to the Lambda node's metadata mapping in that service file (add `services/lambda.ts` to Files Touched if this is required).

2. Same attached + inline policy fetch as EC2 above

**Note on EC2 instance profile ARN:** `describeInstances` returns `IamInstanceProfile.Arn` if an instance profile is attached. This ARN has the form `arn:aws:iam::123:instance-profile/ProfileName`. The role name inside the profile may differ from the profile name. The correct resolution is: extract profile name from ARN suffix, then call `iam.getInstanceProfile(profileName)` to get the attached role name. Add `iam:GetInstanceProfile` to required permissions.

Simplified alternative: assume role name = profile name (common convention for `OrganizationAccountAccessRole`-style deployments). Document this assumption in Inspector error context.

### `fetchS3IamData(node: CloudNode, clients: AwsClients): Promise<PolicyDocument[]>`
1. `s3.getBucketPolicy(bucketName)` → bucket policy document
2. URL-decode and return

**Required IAM permissions (documented in Inspector error message if missing):**
`iam:GetRolePolicy`, `iam:ListAttachedRolePolicies`, `iam:GetPolicy`, `iam:GetPolicyVersion`, `iam:ListRolePolicies`, `iam:GetInstanceProfile`, `s3:GetBucketPolicy`

---

## Policy Evaluator (`src/main/aws/iam/evaluator.ts`)

Pure function — no AWS calls, fully unit-testable:

```typescript
// PolicyDocument type (defined in evaluator.ts — main-process only, not exported to renderer)
interface PolicyStatement {
  Effect: string                                        // 'Allow' | 'Deny'
  Action: string | string[]                             // single action or array
  Resource: string | string[]                           // single resource or array
  Principal?: string | Record<string, string | string[]>  // optional, present in bucket/trust policies
}

interface PolicyDocument {
  Statement: PolicyStatement[]
}

// policyName passed from fetcher — used to detect 'AdministratorAccess' by name
export function evaluatePolicy(doc: PolicyDocument, policyName?: string): IamFinding[]
```

### Ruleset v1

**CRITICAL:**
| Rule | Trigger |
|------|---------|
| AdministratorAccess attached | Managed policy name === `AdministratorAccess` |
| Wildcard action + resource | Statement has `Action: '*'` AND `Resource: '*'` |
| IAM full access | Statement has `Action: 'iam:*'` or `Action: ['iam:*', ...]` |

**WARNING:**
| Rule | Trigger |
|------|---------|
| S3 wildcard | `Action: 's3:*'` with `Resource: '*'` |
| EC2 full access | `Action: 'ec2:*'` |
| AssumeRole wildcard | `Action: 'sts:AssumeRole'` with `Resource: '*'` |
| Public S3 bucket policy | `Principal: '*'` in bucket policy statement |

**INFO:**
| Rule | Trigger |
|------|---------|
| PassRole present | `Action` includes `iam:PassRole` |
| Cross-account trust | Trust policy has external account ID in Principal |

Effect: only statements with `"Effect": "Allow"` are evaluated. Deny statements skipped.

---

## New IPC Channel

| Channel | Direction | Payload | Description |
|---------|-----------|---------|-------------|
| `IAM_ANALYZE` | renderer→main | `{ nodeId, nodeType, metadata }` | Fetch IAM data, evaluate, return IamAnalysisResult |

### Handler timeout
Handler wraps the fetch in a `Promise.race` against a 10-second timeout. On timeout: returns `{ nodeId, findings: [], error: 'IAM analysis timed out after 10s' }`.

### `window.cloudblocks` addition
```typescript
analyzeIam(nodeId: string, nodeType: NodeType, metadata: Record<string, unknown>): Promise<IamAnalysisResult>
```

---

## Inspector Changes (`src/renderer/components/Inspector.tsx`)

New `IamAdvisor` section rendered below metadata for EC2, Lambda, S3 nodes only:

```
IAM Advisor                                      [re-check]
─────────────────────────────────────────────────
  CRITICAL  AdministratorAccess policy attached
            Policy: AdminPolicy | Expand >

  WARNING   s3:* on resource * — overly broad S3 access
            Policy: DataAccess | Expand >

  INFO      iam:PassRole present — verify this is intended
```

**States:**
- Loading: spinner + "Analyzing IAM policies..."
- Empty findings: green "No issues found"
- Error: amber banner with error message + link to required permissions doc
- Missing permissions specifically: "IAM Advisor requires additional permissions: iam:GetRolePolicy, iam:ListAttachedRolePolicies, iam:GetPolicy, iam:GetPolicyVersion, s3:GetBucketPolicy"

**Expand behavior:** Clicking a finding row expands to show the raw policy statement JSON (formatted, not raw string).

**Re-check:** Button re-fires `analyzeIam()` — clears cache, shows loading state.

---

## New `IamAdvisor` Component (`src/renderer/components/IamAdvisor.tsx`)

Extracted from Inspector to keep component focused:

```typescript
interface IamAdvisorProps {
  node: CloudNode
  onRecheck: () => void
  result: IamAnalysisResult | null  // null = loading
}
```

Inspector passes result down as prop — Inspector owns the IPC call, IamAdvisor is pure display.

---

## Files Touched Summary

| File | Action |
|------|--------|
| `src/renderer/types/iam.ts` | Create — IamFinding, IamSeverity, IamAnalysisResult |
| `src/main/aws/client.ts` | Add `iam: IAMClient` to AwsClients interface + createClients() |
| `src/main/aws/iam/fetcher.ts` | Create — fetchEc2IamData, fetchLambdaIamData, fetchS3IamData, urlDecodePolicy() |
| `src/main/aws/iam/evaluator.ts` | Create — PolicyDocument type, evaluatePolicy(), ruleset |
| `src/main/ipc/channels.ts` | Add IAM_ANALYZE |
| `src/main/ipc/handlers.ts` | Register IAM_ANALYZE handler with 10s timeout |
| `src/preload/index.ts` | Expose analyzeIam |
| `src/preload/index.d.ts` | Type declaration |
| `src/renderer/components/IamAdvisor.tsx` | Create — findings display component |
| `src/renderer/components/Inspector.tsx` | Add IAM section for ec2/lambda/s3; useState + useEffect for IPC call; IamAdvisor render |
| `tests/main/aws/iam/evaluator.test.ts` | Create — test all ruleset rules |
| `tests/main/aws/iam/fetcher.test.ts` | Create — test URL-decode pipeline |
| `src/main/aws/services/lambda.ts` | Verify/add `role` (execution role ARN) to Lambda node metadata |

---

## Out of Scope

- IAM evaluation for RDS, ALB, API Gateway, CloudFront (deferred to v2)
- Remediation suggestions (auto-generate least-privilege policy)
- IAM Access Analyzer integration
- Cross-account trust visualization (covered by multi-account pillar)
- Continuous monitoring / alerting on policy changes
