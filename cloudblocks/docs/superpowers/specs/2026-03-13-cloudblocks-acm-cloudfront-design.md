# Cloudblocks — ACM + CloudFront Design Spec
**Date:** 2026-03-13
**Status:** Approved

## Overview

Add AWS Certificate Manager (ACM) and CloudFront as full CRUD services. These are global (non-regional) services and require a new "Global / Edge" zone in the topology view. CloudFront invalidation is included as a quick action. This is Milestone 5a; API Gateway is Milestone 5b.

---

## New Node Types

### `acm` — ACM Certificate

```ts
// CloudNode for ACM
{
  id:     certificateArn,
  type:   'acm',
  label:  primaryDomain,         // e.g. "example.com"
  status: NodeStatus,            // see mapping below
  region: 'global',
  metadata: {
    domainName:               string,   // primary domain
    subjectAlternativeNames:  string[], // SANs
    validationMethod:         'DNS' | 'EMAIL',
    inUseBy:                  string[], // ARNs using this cert
    cnameRecords:             Array<{ name: string; value: string }>, // DNS validation records
  },
  parentId: undefined,
}
```

**Status mapping:**
- `ISSUED` → `running`
- `PENDING_VALIDATION` → `pending`
- `FAILED` | `EXPIRED` | `INACTIVE` | `REVOKED` → `error`
- anything else → `unknown`

### `cloudfront` — CloudFront Distribution

```ts
// CloudNode for CloudFront
{
  id:     distributionId,        // e.g. "E1ABCDEF123456"
  type:   'cloudfront',
  label:  comment || domainName, // friendly name or auto-assigned domain
  status: NodeStatus,            // see mapping below
  region: 'global',
  metadata: {
    domainName:        string,   // *.cloudfront.net domain
    origins:           Array<{ id: string; domainName: string; type: 'S3' | 'custom' }>,
    certArn:           string | undefined,
    priceClass:        'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200',
    defaultRootObject: string,   // e.g. "index.html"
  },
  parentId: undefined,
}
```

**Status mapping:**
- `Deployed` → `running`
- `InProgress` → `pending`
- `Failed` → `error`
- anything else → `unknown`

---

## Scanner

Two new scan functions added to `src/main/aws/scanner.ts` parallel scan:

```ts
import { listCertificates } from './services/acm'
import { listDistributions } from './services/cloudfront'

// In Promise.all:
listCertificates(this.clients.acm),
listDistributions(this.clients.cloudfront),
```

ACM uses `ListCertificates` + `DescribeCertificate` (for CNAME validation records and SANs).
CloudFront uses `ListDistributions`.

Both new clients added to `AwsClients` interface and `createClients()`:
- `ACMClient` from `@aws-sdk/client-acm`
- `CloudFrontClient` from `@aws-sdk/client-cloudfront`

ACM client must use `region: 'us-east-1'` always (ACM for CloudFront only works in us-east-1).
CloudFront client uses any region (it's global).

---

## Topology View — Global Zone

A new `GlobalZoneNode` custom React Flow node renders a shaded container at the top of the canvas (y=0), similar to how `VpcNode` acts as a container.

**Routing rule:** nodes with `region === 'global'` are placed inside the GlobalZone container. All other nodes follow existing VPC/subnet hierarchy.

**Layout constants:**
```ts
const GLOBAL_PAD   = 16   // padding inside GlobalZone container
const GLOBAL_LABEL = 32   // height of GlobalZone header bar
```

**Vertical stacking:** Global zone appears at the top (y=40). VPCs appear below it: when global nodes exist, VPC `y` = `GLOBAL_LABEL + globalZoneHeight + 60` instead of the current hardcoded `40`. The `rootResources` row (currently at `y: 520`) must also shift to `vpcY + maxVpcHeight + 60` to stay below VPCs.

**GlobalZoneNode visual:**
- Dashed border: `1px dashed var(--cb-border)`
- Header bar: `🌐 GLOBAL / EDGE` label in `var(--cb-text-muted)` at 9px
- Background: `rgba(255,255,255,0.02)`
- Not selectable, not clickable

**Edges:** In topology view, CloudFront → origin edges are drawn (solid, `var(--cb-border-strong)`, step type) using the matching rules below. In graph view, additional dotted edge from CloudFront → ACM cert.

**Origin matching rules:**
- S3: `origin.domainName.startsWith(s3Node.id + '.')` — S3 node id is the bucket name; CloudFront S3 origin domains are `<bucket>.s3.amazonaws.com` or `<bucket>.s3-website-<region>.amazonaws.com`
- ALB: `origin.domainName === (albNode.metadata.dnsName as string)` — ALB metadata stores `dnsName` from `lb.DNSName`
- Unmatched origins: no edge drawn

---

## Graph View

CloudFront origin edges derived from metadata:

```ts
// In deriveEdges():
// For cloudfront nodes: draw edges to matched origins
// For origin matching: compare origin.domainName to known node labels/metadata
```

An additional dotted edge connects CloudFront → its ACM cert:
```ts
{
  id:     `cf-cert-${node.id}`,
  source: node.id,
  target: certId,  // look up by certArn in metadata
  type:   'step',
  style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
  label:  'cert',
}
```

---

## CRUD: ACM

### Create
```ts
export interface AcmParams {
  resource: 'acm'
  domainName: string              // primary domain, e.g. "example.com"
  subjectAlternativeNames: string[] // e.g. ["*.example.com"]
  validationMethod: 'DNS' | 'EMAIL'
}
```

CLI command:
```bash
aws acm request-certificate \
  --domain-name <domainName> \
  --validation-method <DNS|EMAIL> \
  --subject-alternative-names <...SANs>
```

### Delete
```bash
aws acm delete-certificate --certificate-arn <arn>
```
Blocked with error in Inspector if `inUseBy.length > 0`.

### Edit
Not supported — ACM certs cannot be meaningfully edited. No edit form.

---

## CRUD: CloudFront

### Create
```ts
export interface CloudFrontParams {
  resource: 'cloudfront'
  comment: string                  // friendly name
  origins: Array<{
    id: string                     // user-defined origin ID
    domainName: string             // picked from existing resources or typed
  }>
  defaultRootObject: string        // e.g. "index.html"
  certArn?: string                 // ARN of an ISSUED ACM cert, or leave blank for default CloudFront cert
  priceClass: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}
```

CLI command:
```bash
aws cloudfront create-distribution --distribution-config file://<tempfile>
```
(Write JSON to temp file and pass path — avoids shell escaping complexity)

### Edit
```ts
export interface CloudFrontEditParams {
  resource: 'cloudfront'
  comment?: string
  defaultRootObject?: string
  certArn?: string
  priceClass?: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}
```

CLI:
```bash
# Get current config + ETag, then update
aws cloudfront get-distribution-config --id <id>
aws cloudfront update-distribution --id <id> --distribution-config file://<tempfile> --if-match <etag>
```

### Delete
```bash
# Must disable first, then delete
aws cloudfront get-distribution-config --id <id>
# (set Enabled: false, update-distribution)
aws cloudfront delete-distribution --id <id> --if-match <etag>
```

### Quick Action: Invalidate Cache
Input: path string (e.g. `/*`, `/index.html`)

```bash
aws cloudfront create-invalidation \
  --distribution-id <id> \
  --paths <path>
```

Inspector shows a text input + "Invalidate" button when a CloudFront node is selected.
The `onQuickAction` prop extended: action type expanded to include `'invalidate'` with an associated path.

---

## Inspector Changes

**ACM node selected:**
- Standard fields: ID, NAME, REGION, STATE
- Metadata: domainName, validationMethod, inUseBy count
- If `status === 'pending'` and `cnameRecords.length > 0`: show each CNAME record with a copy button
- No edit button (ACM edit not supported)
- Delete button (shows error if inUseBy > 0)

**CloudFront node selected:**
- Standard fields + metadata (domainName, origins count, certArn, priceClass)
- Edit + Delete buttons
- Quick action section: "Invalidate Cache" — text input defaulting to `/*`, plus "Invalidate" button

**ACM node selected:**
- Edit button is suppressed (no edit form for ACM)
- Delete button shown (blocked with UI error message if `inUseBy.length > 0`)

**`onQuickAction` signature extension:**

The existing `Inspector` prop `onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot') => void` is extended to a union:
```ts
onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }) => void
```
`App.tsx` handles `'invalidate'` by calling `window.cloudblocks.invalidateCloudFront(node.id, meta?.path ?? '/*')`.

---

## Forms

All form components follow the existing pattern in `src/renderer/components/modals/`.

### AcmForm (create only)
Fields:
- Primary domain (text input, required)
- Subject alternative names (multi-value text inputs, add/remove rows; omit from CLI args if empty)
- Validation method (DNS / Email radio)

### CloudFrontForm (create)
Fields:
- Comment / name (text, required)
- Origins (multi-row: ID + domain name; domain name has dropdown of scanned S3/ALB labels if available, or free-text)
- Default root object (text, default `index.html`)
- ACM certificate (dropdown of scanned ACM nodes with status=running, or "Use default CloudFront cert")
- Price class (select: All / 100 / 200)

### CloudFrontEditForm
Fields: Comment, default root object, certificate, price class (same dropdowns)

---

## Write Strategy

### ACM (CLI via CliEngine)

ACM create and delete use simple CLI commands added to `buildCommands` / `buildDeleteCommands` — same as existing services.

**Create:**
```ts
['acm', 'request-certificate',
  '--domain-name', params.domainName,
  '--validation-method', params.validationMethod,
  ...(params.subjectAlternativeNames.length > 0
    ? ['--subject-alternative-names', ...params.subjectAlternativeNames]
    : []),
]
```

**Delete:**
```ts
['acm', 'delete-certificate', '--certificate-arn', node.id]
```
Blocked in UI if `node.metadata.inUseBy.length > 0` — show "Cannot delete: in use by N resources".

### CloudFront (SDK in main process for write operations)

CloudFront write operations require a read-modify-write cycle (ETag from `GetDistributionConfig`). Rather than extending the CliEngine, CloudFront writes use AWS SDK calls in dedicated IPC handlers — same approach as `settings:get`/`settings:set`.

**New IPC channels added to `channels.ts`:**
```ts
CF_CREATE:     'cloudfront:create',   // invoke → { code: number }
CF_UPDATE:     'cloudfront:update',   // invoke → { code: number }
CF_DELETE:     'cloudfront:delete',   // invoke → { code: number }
CF_INVALIDATE: 'cloudfront:invalidate', // invoke → { code: number }
```

**cloudfront:create** — calls SDK `CreateDistributionCommand` with config built from `CloudFrontParams`.

**cloudfront:update** — calls `GetDistributionConfigCommand` to get ETag, then `UpdateDistributionCommand` with modified config and ETag.

**cloudfront:delete** — calls `GetDistributionConfigCommand` to get ETag, if `Enabled: true` calls `UpdateDistributionCommand` to disable, then polls `GetDistributionCommand` every 5 seconds (max 60 seconds / 12 attempts) until `Status === 'Deployed'`, then calls `DeleteDistributionCommand` with new ETag. If polling times out, handler returns `{ code: 1, error: 'Timeout waiting for distribution to disable' }`.

**cloudfront:invalidate** — calls `CreateInvalidationCommand` with `{ Paths: { Quantity: 1, Items: [path] }, CallerReference: Date.now().toString() }`.

**Renderer side:** `CloudFrontForm` and `CloudFrontEditForm` call `window.cloudblocks.createCloudFront(params)` / `window.cloudblocks.updateCloudFront(params)` instead of `window.cloudblocks.runCli()`. The `window.cloudblocks` preload API is extended accordingly.

**handlers.ts wiring:** The existing `handlers.ts` does not expose `clients` at module scope — they are recreated inside `restartScanner()`. Add a module-level `let clients: AwsClients | null = null` variable; set it in `restartScanner()` alongside `scanner`. CloudFront IPC handlers read `clients?.cloudfront` to get the live `CloudFrontClient`.

---

## New Files

| File | Purpose |
|------|---------|
| `src/main/aws/services/acm.ts` | Scan + CRUD for ACM |
| `src/main/aws/services/cloudfront.ts` | Scan + CRUD for CloudFront (SDK write methods) |
| `src/renderer/components/canvas/nodes/GlobalZoneNode.tsx` | Container node for Global zone |
| `src/renderer/components/canvas/nodes/AcmNode.tsx` | ACM resource node |
| `src/renderer/components/canvas/nodes/CloudFrontNode.tsx` | CloudFront resource node |
| `src/renderer/components/modals/AcmForm.tsx` | Create ACM cert form |
| `src/renderer/components/modals/CloudFrontForm.tsx` | Create CloudFront distribution form |
| `src/renderer/components/modals/CloudFrontEditForm.tsx` | Edit CloudFront distribution form |

## Modified Files

| File | Change |
|------|--------|
| `src/main/aws/client.ts` | Add `acm`, `cloudfront` to `AwsClients` + `createClients` |
| `src/main/aws/scanner.ts` | Add ACM + CloudFront to `Promise.all` scan |
| `src/main/ipc/channels.ts` | Add `CF_CREATE`, `CF_UPDATE`, `CF_DELETE`, `CF_INVALIDATE` channels |
| `src/main/ipc/handlers.ts` | Add CloudFront SDK write handlers |
| `src/preload/index.ts` | Expose `createCloudFront`, `updateCloudFront`, `deleteCloudFront`, `invalidateCloudFront` on `window.cloudblocks` |
| `src/renderer/types/cloud.ts` | Add `'acm'`, `'cloudfront'` to `NodeType` |
| `src/renderer/types/create.ts` | Add `AcmParams`, `CloudFrontParams`, extend `CreateParams` |
| `src/renderer/types/edit.ts` | Add `CloudFrontEditParams`, extend `EditParams` |
| `src/renderer/utils/buildDeleteCommands.ts` | Add `acm` delete case |
| `src/renderer/utils/buildCommand.ts` | Add `acm` create case |
| `src/renderer/components/canvas/TopologyView.tsx` | Add GlobalZone layout logic |
| `src/renderer/components/canvas/GraphView.tsx` | Add CloudFront origin + cert edges |
| `src/renderer/components/Inspector.tsx` | Handle `acm`, `cloudfront` node types |

---

## Scope

**In scope:**
- ACM: scan, create, delete
- CloudFront: scan, create, edit, delete, invalidate
- GlobalZone container in topology view
- CloudFront → origin edges (topology + graph)
- CloudFront → ACM cert edge (graph only)
- ACM CNAME records display with copy

**Out of scope:**
- CloudFront behaviors/cache policies (just default behavior)
- ACM email resend action (deferred)
- Route 53 auto-wiring
- WAF associations
- API Gateway (Milestone 5b)
