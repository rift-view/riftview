# ACM + CloudFront (M5a) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AWS Certificate Manager and CloudFront as full CRUD services with a Global Zone in the topology view.

**Architecture:** ACM uses CLI for create/delete; CloudFront uses AWS SDK for create/update/delete (requires read-modify-write ETag cycle) with CLI for invalidation. Both are scanned via SDK in the main process scanner. A new GlobalZoneNode container in TopologyView holds global (region='global') resources above VPCs.

**Tech Stack:** AWS SDK v3 (`@aws-sdk/client-acm`, `@aws-sdk/client-cloudfront`), React 18, TypeScript, Electron 32, Zustand 5, Vitest

**Spec:** `docs/superpowers/specs/2026-03-13-cloudblocks-acm-cloudfront-design.md`

---

## Chunk 1: Data layer — types, clients, scan services, scanner wiring

### Task 1: Install SDK packages + extend types

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/renderer/types/cloud.ts`
- Modify: `src/main/aws/client.ts`

- [ ] **Step 1: Install the two new SDK packages**

```bash
npm install @aws-sdk/client-acm @aws-sdk/client-cloudfront
```

Expected: packages added to `node_modules` and `package.json` dependencies.

- [ ] **Step 2: Write failing type test**

Add to `src/renderer/store/__tests__/cloud.test.ts` in the existing `NodeType` describe block (or create a new describe block if none exists):

```ts
it('NodeType includes acm and cloudfront', () => {
  const types: NodeType[] = ['acm', 'cloudfront']
  types.forEach(t => expect(t).toBeTruthy())
})
```

Add `import type { NodeType } from '../../types/cloud'` if not already imported.

- [ ] **Step 3: Run test to verify it fails**

```bash
./node_modules/.bin/vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: TypeScript error — `'acm'` not assignable to `NodeType`

- [ ] **Step 4: Add CloudFront + ACM types to `src/renderer/types/create.ts`**

Read `src/renderer/types/create.ts` first. Add the following BEFORE the existing `export type CreateParams = ...` line, so cloudfront.ts (Task 3) can import them immediately:

```ts
export interface CloudFrontOrigin {
  id: string
  domainName: string
}

export interface CloudFrontParams {
  resource: 'cloudfront'
  comment: string
  origins: CloudFrontOrigin[]
  defaultRootObject: string
  certArn?: string
  priceClass: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}

export interface CloudFrontEditParams {
  resource: 'cloudfront'
  comment?: string
  defaultRootObject?: string
  certArn?: string
  priceClass?: 'PriceClass_All' | 'PriceClass_100' | 'PriceClass_200'
}
```

Do NOT yet extend `CreateParams` union — that happens in Task 5 when AcmParams is also added.

- [ ] **Step 5: Extend NodeType in `src/renderer/types/cloud.ts`**

Find:
```ts
export type NodeType =
  | 'ec2'
  | 'vpc'
  | 'subnet'
  | 'rds'
  | 's3'
  | 'lambda'
  | 'alb'
  | 'security-group'
  | 'igw'
```

Replace with:
```ts
export type NodeType =
  | 'ec2'
  | 'vpc'
  | 'subnet'
  | 'rds'
  | 's3'
  | 'lambda'
  | 'alb'
  | 'security-group'
  | 'igw'
  | 'acm'
  | 'cloudfront'
```

- [ ] **Step 5: Add ACM + CloudFront clients to `src/main/aws/client.ts`**

Replace the entire file content with:

```ts
import { EC2Client } from '@aws-sdk/client-ec2'
import { RDSClient } from '@aws-sdk/client-rds'
import { S3Client } from '@aws-sdk/client-s3'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2'
import { ACMClient } from '@aws-sdk/client-acm'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'

export interface AwsClients {
  ec2:        EC2Client
  rds:        RDSClient
  s3:         S3Client
  lambda:     LambdaClient
  alb:        ElasticLoadBalancingV2Client
  acm:        ACMClient
  cloudfront: CloudFrontClient
}

// Creates a fresh set of AWS SDK clients for the given profile + region.
export function createClients(profile: string, region: string): AwsClients {
  const config = { region }

  // Set AWS_PROFILE so the SDK credential provider picks up the right profile.
  process.env.AWS_PROFILE = profile
  process.env.AWS_REGION = region

  return {
    ec2:        new EC2Client(config),
    rds:        new RDSClient(config),
    s3:         new S3Client(config),
    lambda:     new LambdaClient(config),
    alb:        new ElasticLoadBalancingV2Client(config),
    // ACM for CloudFront must use us-east-1 always
    acm:        new ACMClient({ region: 'us-east-1' }),
    cloudfront: new CloudFrontClient({ region: 'us-east-1' }),
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
./node_modules/.bin/vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/renderer/types/cloud.ts src/main/aws/client.ts src/renderer/store/__tests__/cloud.test.ts
git commit -m "feat: install ACM/CloudFront SDK packages, extend NodeType and AwsClients"
```

---

### Task 2: ACM scan service

**Files:**
- Create: `src/main/aws/services/acm.ts`
- Create: `tests/main/aws/services/acm.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/aws/services/acm.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { ACMClient } from '@aws-sdk/client-acm'
import { listCertificates } from '../../../../src/main/aws/services/acm'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ACMClient

describe('listCertificates', () => {
  it('maps ISSUED cert to running CloudNode', async () => {
    mockSend
      .mockResolvedValueOnce({
        CertificateSummaryList: [{ CertificateArn: 'arn:aws:acm:us-east-1:123:certificate/abc', DomainName: 'example.com' }],
      })
      .mockResolvedValueOnce({
        Certificate: {
          CertificateArn: 'arn:aws:acm:us-east-1:123:certificate/abc',
          DomainName: 'example.com',
          SubjectAlternativeNames: ['*.example.com'],
          Status: 'ISSUED',
          Type: 'AMAZON_ISSUED',
          ValidationMethod: 'DNS',
          InUseBy: [],
          DomainValidationOptions: [],
        },
      })
    const nodes = await listCertificates(mockClient)
    expect(nodes[0].type).toBe('acm')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('global')
    expect(nodes[0].metadata.domainName).toBe('example.com')
  })

  it('maps PENDING_VALIDATION to pending', async () => {
    mockSend
      .mockResolvedValueOnce({
        CertificateSummaryList: [{ CertificateArn: 'arn:...', DomainName: 'test.com' }],
      })
      .mockResolvedValueOnce({
        Certificate: {
          CertificateArn: 'arn:...',
          DomainName: 'test.com',
          SubjectAlternativeNames: [],
          Status: 'PENDING_VALIDATION',
          ValidationMethod: 'DNS',
          InUseBy: [],
          DomainValidationOptions: [{
            DomainName: 'test.com',
            ResourceRecord: { Name: '_abc.test.com', Value: '_xyz.acm.amazonaws.com' },
          }],
        },
      })
    const nodes = await listCertificates(mockClient)
    expect(nodes[0].status).toBe('pending')
    expect((nodes[0].metadata.cnameRecords as Array<{name: string; value: string}>).length).toBe(1)
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('err'))
    expect(await listCertificates(mockClient)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
./node_modules/.bin/vitest run tests/main/aws/services/acm.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/main/aws/services/acm.ts`**

```ts
import {
  ACMClient,
  ListCertificatesCommand,
  DescribeCertificateCommand,
} from '@aws-sdk/client-acm'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function acmStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'ISSUED')              return 'running'
  if (status === 'PENDING_VALIDATION')  return 'pending'
  if (status === 'FAILED' || status === 'EXPIRED' || status === 'INACTIVE' || status === 'REVOKED') return 'error'
  return 'unknown'
}

export async function listCertificates(client: ACMClient): Promise<CloudNode[]> {
  try {
    const list = await client.send(new ListCertificatesCommand({ MaxItems: 100 }))
    const arns = (list.CertificateSummaryList ?? []).map((c) => c.CertificateArn).filter(Boolean) as string[]

    const details = await Promise.all(
      arns.map((arn) =>
        client.send(new DescribeCertificateCommand({ CertificateArn: arn })).catch(() => null),
      ),
    )

    return details
      .filter((d): d is NonNullable<typeof d> => d !== null && !!d.Certificate)
      .map((d): CloudNode => {
        const cert = d.Certificate!
        const cnameRecords = (cert.DomainValidationOptions ?? [])
          .filter((o) => o.ResourceRecord)
          .map((o) => ({
            name:  o.ResourceRecord!.Name ?? '',
            value: o.ResourceRecord!.Value ?? '',
          }))

        return {
          id:     cert.CertificateArn!,
          type:   'acm',
          label:  cert.DomainName ?? 'Certificate',
          status: acmStatusToNodeStatus(cert.Status),
          region: 'global',
          metadata: {
            domainName:              cert.DomainName ?? '',
            subjectAlternativeNames: cert.SubjectAlternativeNames ?? [],
            validationMethod:        cert.ValidationMethod ?? 'DNS',
            inUseBy:                 cert.InUseBy ?? [],
            cnameRecords,
          },
        }
      })
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
./node_modules/.bin/vitest run tests/main/aws/services/acm.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/aws/services/acm.ts tests/main/aws/services/acm.test.ts
git commit -m "feat: add ACM scan service"
```

---

### Task 3: CloudFront scan service

**Files:**
- Create: `src/main/aws/services/cloudfront.ts`
- Create: `tests/main/aws/services/cloudfront.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/aws/services/cloudfront.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { CloudFrontClient } from '@aws-sdk/client-cloudfront'
import { listDistributions } from '../../../../src/main/aws/services/cloudfront'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as CloudFrontClient

describe('listDistributions', () => {
  it('maps Deployed distribution to running CloudNode', async () => {
    mockSend.mockResolvedValueOnce({
      DistributionList: {
        Items: [{
          Id: 'E1ABCDEF',
          DomainName: 'abc.cloudfront.net',
          Comment: 'prod-cdn',
          Status: 'Deployed',
          PriceClass: 'PriceClass_All',
          Origins: {
            Items: [{ Id: 'S3-origin', DomainName: 'mybucket.s3.amazonaws.com' }],
          },
          ViewerCertificate: { ACMCertificateArn: 'arn:aws:acm:us-east-1:123:certificate/abc' },
          DefaultRootObject: 'index.html',
        }],
      },
    })
    const nodes = await listDistributions(mockClient)
    expect(nodes[0].type).toBe('cloudfront')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('global')
    expect(nodes[0].label).toBe('prod-cdn')
    expect(nodes[0].metadata.certArn).toBe('arn:aws:acm:us-east-1:123:certificate/abc')
  })

  it('maps InProgress to pending', async () => {
    mockSend.mockResolvedValueOnce({
      DistributionList: {
        Items: [{ Id: 'E2', DomainName: 'xyz.cloudfront.net', Comment: '', Status: 'InProgress', PriceClass: 'PriceClass_100', Origins: { Items: [] }, ViewerCertificate: {}, DefaultRootObject: '' }],
      },
    })
    const nodes = await listDistributions(mockClient)
    expect(nodes[0].status).toBe('pending')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('err'))
    expect(await listDistributions(mockClient)).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
./node_modules/.bin/vitest run tests/main/aws/services/cloudfront.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found

- [ ] **Step 3: Create `src/main/aws/services/cloudfront.ts`**

```ts
import {
  CloudFrontClient,
  ListDistributionsCommand,
  CreateDistributionCommand,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
  DeleteDistributionCommand,
  CreateInvalidationCommand,
  GetDistributionCommand,
  type DistributionConfig,
} from '@aws-sdk/client-cloudfront'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'
import type { CloudFrontParams, CloudFrontEditParams } from '../../../renderer/types/create'

function cfStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'Deployed')   return 'running'
  if (status === 'InProgress') return 'pending'
  return 'unknown'
}

export async function listDistributions(client: CloudFrontClient): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListDistributionsCommand({}))
    return (res.DistributionList?.Items ?? []).map((d): CloudNode => ({
      id:     d.Id!,
      type:   'cloudfront',
      label:  d.Comment || d.DomainName || d.Id!,
      status: cfStatusToNodeStatus(d.Status),
      region: 'global',
      metadata: {
        domainName:        d.DomainName ?? '',
        origins:           (d.Origins?.Items ?? []).map((o) => ({ id: o.Id, domainName: o.DomainName ?? '' })),
        certArn:           d.ViewerCertificate?.ACMCertificateArn ?? undefined,
        priceClass:        d.PriceClass ?? 'PriceClass_All',
        defaultRootObject: d.DefaultRootObject ?? '',
      },
    }))
  } catch {
    return []
  }
}

export async function createDistribution(client: CloudFrontClient, params: CloudFrontParams): Promise<void> {
  const config: DistributionConfig = {
    CallerReference: Date.now().toString(),
    Comment: params.comment,
    DefaultRootObject: params.defaultRootObject,
    Origins: {
      Quantity: params.origins.length,
      Items: params.origins.map((o) => ({
        Id: o.id,
        DomainName: o.domainName,
        S3OriginConfig: o.domainName.includes('.s3.') ? { OriginAccessIdentity: '' } : undefined,
        CustomOriginConfig: !o.domainName.includes('.s3.')
          ? { HTTPSPort: 443, HTTPPort: 80, OriginProtocolPolicy: 'https-only' }
          : undefined,
      })),
    },
    DefaultCacheBehavior: {
      TargetOriginId:       params.origins[0]?.id ?? 'default',
      ViewerProtocolPolicy: 'redirect-to-https',
      CachePolicyId:        '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized managed policy
      AllowedMethods: { Quantity: 2, Items: ['GET', 'HEAD'] },
    },
    ViewerCertificate: params.certArn
      ? { ACMCertificateArn: params.certArn, SSLSupportMethod: 'sni-only', MinimumProtocolVersion: 'TLSv1.2_2021' }
      : { CloudFrontDefaultCertificate: true },
    PriceClass: params.priceClass,
    Enabled: true,
  }
  await client.send(new CreateDistributionCommand({ DistributionConfig: config }))
}

export async function updateDistribution(client: CloudFrontClient, id: string, params: CloudFrontEditParams): Promise<void> {
  const { DistributionConfig: current, ETag } = await client.send(new GetDistributionConfigCommand({ Id: id }))
  if (!current || !ETag) throw new Error('Could not fetch distribution config')

  const updated: DistributionConfig = {
    ...current,
    Comment:           params.comment           ?? current.Comment,
    DefaultRootObject: params.defaultRootObject ?? current.DefaultRootObject,
    PriceClass:        params.priceClass        ?? current.PriceClass,
    ViewerCertificate: params.certArn
      ? { ACMCertificateArn: params.certArn, SSLSupportMethod: 'sni-only', MinimumProtocolVersion: 'TLSv1.2_2021' }
      : current.ViewerCertificate,
  }

  await client.send(new UpdateDistributionCommand({ Id: id, IfMatch: ETag, DistributionConfig: updated }))
}

export async function deleteDistribution(client: CloudFrontClient, id: string): Promise<void> {
  // Step 1: Get config + ETag
  const { DistributionConfig: config, ETag } = await client.send(new GetDistributionConfigCommand({ Id: id }))
  if (!config || !ETag) throw new Error('Could not fetch distribution config')

  let currentETag = ETag

  // Step 2: If enabled, disable first
  if (config.Enabled) {
    const disabledConfig: DistributionConfig = { ...config, Enabled: false }
    await client.send(new UpdateDistributionCommand({ Id: id, IfMatch: currentETag, DistributionConfig: disabledConfig }))

    // Step 3: Poll until Deployed (max 60s)
    const MAX_ATTEMPTS = 12
    const INTERVAL_MS  = 5_000
    let attempts = 0
    while (attempts < MAX_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS))
      const status = await client.send(new GetDistributionCommand({ Id: id }))
      if (status.Distribution?.Status === 'Deployed') {
        currentETag = status.ETag ?? currentETag
        break
      }
      attempts++
    }
    if (attempts >= MAX_ATTEMPTS) throw new Error('Timeout waiting for distribution to disable')
  }

  // Step 4: Delete
  await client.send(new DeleteDistributionCommand({ Id: id, IfMatch: currentETag }))
}

export async function createInvalidation(client: CloudFrontClient, id: string, path: string): Promise<void> {
  await client.send(new CreateInvalidationCommand({
    DistributionId: id,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: { Quantity: 1, Items: [path] },
    },
  }))
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
./node_modules/.bin/vitest run tests/main/aws/services/cloudfront.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/aws/services/cloudfront.ts tests/main/aws/services/cloudfront.test.ts
git commit -m "feat: add CloudFront scan + write service"
```

---

### Task 4: Wire ACM + CloudFront into scanner and IPC

**Files:**
- Modify: `src/main/aws/scanner.ts`
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`

- [ ] **Step 1: Read current files**

Read `src/main/aws/scanner.ts`, `src/main/ipc/channels.ts`, `src/main/ipc/handlers.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`.

- [ ] **Step 2: Update scanner.ts to scan ACM + CloudFront**

In `src/main/aws/scanner.ts`:

Add imports:
```ts
import { listCertificates } from './services/acm'
import { listDistributions } from './services/cloudfront'
```

In the `scan()` method, expand the `Promise.all` from:
```ts
const [instances, vpcs, subnets, sgs, dbs, buckets, fns, lbs] = await Promise.all([
  describeInstances(this.clients.ec2, this.region),
  describeVpcs(this.clients.ec2, this.region),
  describeSubnets(this.clients.ec2, this.region),
  describeSecurityGroups(this.clients.ec2, this.region),
  describeDBInstances(this.clients.rds, this.region),
  listBuckets(this.clients.s3, this.region),
  listFunctions(this.clients.lambda, this.region),
  describeLoadBalancers(this.clients.alb, this.region),
])

const nextNodes = [...instances, ...vpcs, ...subnets, ...sgs, ...dbs, ...buckets, ...fns, ...lbs]
```

To:
```ts
const [instances, vpcs, subnets, sgs, dbs, buckets, fns, lbs, certs, distributions] = await Promise.all([
  describeInstances(this.clients.ec2, this.region),
  describeVpcs(this.clients.ec2, this.region),
  describeSubnets(this.clients.ec2, this.region),
  describeSecurityGroups(this.clients.ec2, this.region),
  describeDBInstances(this.clients.rds, this.region),
  listBuckets(this.clients.s3, this.region),
  listFunctions(this.clients.lambda, this.region),
  describeLoadBalancers(this.clients.alb, this.region),
  listCertificates(this.clients.acm),
  listDistributions(this.clients.cloudfront),
])

const nextNodes = [...instances, ...vpcs, ...subnets, ...sgs, ...dbs, ...buckets, ...fns, ...lbs, ...certs, ...distributions]
```

- [ ] **Step 3: Add CloudFront IPC channels to `src/main/ipc/channels.ts`**

```ts
export const IPC = {
  PROFILES_LIST:   'profiles:list',
  PROFILE_SELECT:  'profile:select',
  REGION_SELECT:   'region:select',
  SCAN_START:      'scan:start',
  SCAN_DELTA:      'scan:delta',
  SCAN_STATUS:     'scan:status',
  CONN_STATUS:     'conn:status',
  CLI_RUN:         'cli:run',
  CLI_OUTPUT:      'cli:output',
  CLI_DONE:        'cli:done',
  CLI_CANCEL:      'cli:cancel',
  SCAN_KEYPAIRS:   'scan:keypairs',
  SETTINGS_GET:    'settings:get',
  SETTINGS_SET:    'settings:set',
  THEME_OVERRIDES: 'theme:overrides',
  CF_CREATE:       'cloudfront:create',
  CF_UPDATE:       'cloudfront:update',
  CF_DELETE:       'cloudfront:delete',
  CF_INVALIDATE:   'cloudfront:invalidate',
} as const
```

- [ ] **Step 4: Add CloudFront handlers to `src/main/ipc/handlers.ts`**

Add at the top of `handlers.ts` after existing imports:
```ts
import type { AwsClients } from '../aws/client'
import { createDistribution, updateDistribution, deleteDistribution, createInvalidation } from '../aws/services/cloudfront'
import type { CloudFrontParams, CloudFrontEditParams } from '../../renderer/types/create'
```

Add `let clients: AwsClients | null = null` at module scope alongside `let scanner` and `let cliEngine`:
```ts
let scanner:   ResourceScanner | null = null
let cliEngine: CliEngine       | null = null
let clients:   AwsClients      | null = null
```

Update `restartScanner()` to save clients:
```ts
function restartScanner(win: BrowserWindow, profile: string, region: string): void {
  scanner?.stop()
  cliEngine = new CliEngine(win)
  clients   = createClients(profile, region)
  scanner   = new ResourceScanner(clients, region, win)
  scanner.start()
}
```

Add CloudFront handlers inside `registerHandlers()`:
```ts
ipcMain.handle(IPC.CF_CREATE, async (_e, params: CloudFrontParams) => {
  if (!clients) return { code: 1, error: 'Not connected' }
  try {
    await createDistribution(clients.cloudfront, params)
    return { code: 0 }
  } catch (err) {
    return { code: 1, error: String(err) }
  }
})

ipcMain.handle(IPC.CF_UPDATE, async (_e, id: string, params: CloudFrontEditParams) => {
  if (!clients) return { code: 1, error: 'Not connected' }
  try {
    await updateDistribution(clients.cloudfront, id, params)
    return { code: 0 }
  } catch (err) {
    return { code: 1, error: String(err) }
  }
})

ipcMain.handle(IPC.CF_DELETE, async (_e, id: string) => {
  if (!clients) return { code: 1, error: 'Not connected' }
  try {
    await deleteDistribution(clients.cloudfront, id)
    return { code: 0 }
  } catch (err) {
    return { code: 1, error: String(err) }
  }
})

ipcMain.handle(IPC.CF_INVALIDATE, async (_e, id: string, path: string) => {
  if (!clients) return { code: 1, error: 'Not connected' }
  try {
    await createInvalidation(clients.cloudfront, id, path)
    return { code: 0 }
  } catch (err) {
    return { code: 1, error: String(err) }
  }
})
```

- [ ] **Step 5: Extend preload at `src/preload/index.ts`**

Add to the `contextBridge.exposeInMainWorld('cloudblocks', { ... })` object:
```ts
createCloudFront:    (params: import('../renderer/types/create').CloudFrontParams) =>
  ipcRenderer.invoke(IPC.CF_CREATE, params),
updateCloudFront:    (id: string, params: import('../renderer/types/create').CloudFrontEditParams) =>
  ipcRenderer.invoke(IPC.CF_UPDATE, id, params),
deleteCloudFront:    (id: string) =>
  ipcRenderer.invoke(IPC.CF_DELETE, id),
invalidateCloudFront: (id: string, path: string) =>
  ipcRenderer.invoke(IPC.CF_INVALIDATE, id, path),
```

- [ ] **Step 6: Update preload type declarations `src/preload/index.d.ts`**

Read the existing file first. Then add the four new methods to the `cloudblocks` interface inside `interface Window { cloudblocks: { ... } }`:

```ts
createCloudFront(params: import('../renderer/types/create').CloudFrontParams): Promise<{ code: number; error?: string }>
updateCloudFront(id: string, params: import('../renderer/types/create').CloudFrontEditParams): Promise<{ code: number; error?: string }>
deleteCloudFront(id: string): Promise<{ code: number; error?: string }>
invalidateCloudFront(id: string, path: string): Promise<{ code: number; error?: string }>
```

- [ ] **Step 7: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
```

Expected: no real errors

- [ ] **Step 8: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add src/main/aws/scanner.ts src/main/ipc/channels.ts src/main/ipc/handlers.ts src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: wire ACM + CloudFront into scanner and IPC handlers"
```

---

## Chunk 2: ACM CRUD

### Task 5: ACM create/delete CLI commands + types

**Files:**
- Modify: `src/renderer/types/create.ts`
- Modify: `src/renderer/utils/buildCommand.ts`
- Modify: `src/renderer/utils/buildDeleteCommands.ts`
- Modify (test): `src/renderer/utils/__tests__/buildCommand.test.ts`

- [ ] **Step 1: Read the files**

Read `src/renderer/types/create.ts`, `src/renderer/utils/buildCommand.ts`, `src/renderer/utils/buildDeleteCommands.ts`, and the buildCommand test file.

- [ ] **Step 2: Write failing tests**

In `src/renderer/utils/__tests__/buildCommand.test.ts`, add:

```ts
describe('acm', () => {
  it('builds request-certificate with DNS validation', () => {
    const cmds = buildCommands({
      resource: 'acm',
      domainName: 'example.com',
      subjectAlternativeNames: ['*.example.com'],
      validationMethod: 'DNS',
    })
    expect(cmds[0]).toContain('request-certificate')
    expect(cmds[0]).toContain('example.com')
    expect(cmds[0]).toContain('DNS')
    expect(cmds[0]).toContain('*.example.com')
  })

  it('omits --subject-alternative-names when SANs is empty', () => {
    const cmds = buildCommands({
      resource: 'acm',
      domainName: 'example.com',
      subjectAlternativeNames: [],
      validationMethod: 'DNS',
    })
    expect(cmds[0]).not.toContain('--subject-alternative-names')
  })
})
```

Also add a test for buildDeleteCommands with acm type. Check the test file structure first, then add:

```ts
it('builds acm delete-certificate command', () => {
  const node = { id: 'arn:aws:acm:us-east-1:123:certificate/abc', type: 'acm' as const } as CloudNode
  const cmds = buildDeleteCommands(node)
  expect(cmds[0]).toEqual(['acm', 'delete-certificate', '--certificate-arn', 'arn:aws:acm:us-east-1:123:certificate/abc'])
})
```

- [ ] **Step 3: Run to verify tests fail**

```bash
./node_modules/.bin/vitest run src/renderer/utils/__tests__/buildCommand.test.ts 2>&1 | tail -10
```

Expected: FAIL — `AcmParams` not in types

- [ ] **Step 4: Add `AcmParams` to `src/renderer/types/create.ts`**

`CloudFrontParams`, `CloudFrontOrigin`, and `CloudFrontEditParams` were already added in Task 1 Step 4. Only add `AcmParams` and extend the union.

Add before `export type CreateParams = ...`:
```ts
export interface AcmParams {
  resource: 'acm'
  domainName: string
  subjectAlternativeNames: string[]
  validationMethod: 'DNS' | 'EMAIL'
}
```

Extend `CreateParams` union to include both new types:
```ts
export type CreateParams = VpcParams | Ec2Params | SgParams | S3Params | RdsParams | LambdaParams | AlbParams | AcmParams | CloudFrontParams
```

- [ ] **Step 5: Add `acm` case to `buildCommand.ts`**

Add import at top:
```ts
import type { CreateParams, SgParams, S3Params, RdsParams, LambdaParams, AlbParams, AcmParams } from '../types/create'
```

Add case to switch:
```ts
case 'acm':
  return buildAcmCommands(params as AcmParams)
```

Add helper function:
```ts
function buildAcmCommands(p: AcmParams): string[][] {
  const args = [
    'acm', 'request-certificate',
    '--domain-name', p.domainName,
    '--validation-method', p.validationMethod,
  ]
  if (p.subjectAlternativeNames.length > 0) {
    args.push('--subject-alternative-names', ...p.subjectAlternativeNames)
  }
  return [args]
}
```

- [ ] **Step 6: Add `acm` case to `buildDeleteCommands.ts`**

In the switch statement, add before `default`:
```ts
case 'acm':
  return [['acm', 'delete-certificate', '--certificate-arn', node.id]]
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
./node_modules/.bin/vitest run src/renderer/utils/__tests__/buildCommand.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 8: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass

- [ ] **Step 9: Commit**

```bash
git add src/renderer/types/create.ts src/renderer/utils/buildCommand.ts src/renderer/utils/buildDeleteCommands.ts src/renderer/utils/__tests__/buildCommand.test.ts
git commit -m "feat: add ACM + CloudFront param types, ACM CLI commands"
```

---

### Task 6: AcmForm modal + NodeContextMenu label

**Files:**
- Create: `src/renderer/components/modals/AcmForm.tsx`
- Modify: `src/renderer/components/canvas/NodeContextMenu.tsx`
- Modify: `src/renderer/components/modals/CreateModal.tsx`

- [ ] **Step 1: Read the files**

Read `src/renderer/components/modals/AlbForm.tsx` (for pattern reference), `src/renderer/components/modals/CreateModal.tsx`, and `src/renderer/components/canvas/NodeContextMenu.tsx`.

- [ ] **Step 2: Create `src/renderer/components/modals/AcmForm.tsx`**

Following the exact same style as `AlbForm.tsx`:

```tsx
import React, { useState } from 'react'
import type { AcmParams } from '../../types/create'

interface Props { onChange: (p: AcmParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)',
  fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = {
  fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8,
}

export function AcmForm({ onChange, showErrors }: Props) {
  const [domainName, setDomainName] = useState('')
  const [sanInput, setSanInput] = useState('')   // comma-separated SANs
  const [validationMethod, setValidationMethod] = useState<'DNS' | 'EMAIL'>('DNS')
  const err = showErrors ?? false

  const emit = (domain: string, sans: string, method: 'DNS' | 'EMAIL') => {
    const sansArr = sans.split(',').map(s => s.trim()).filter(Boolean)
    onChange({ resource: 'acm', domainName: domain, subjectAlternativeNames: sansArr, validationMethod: method })
  }

  return (
    <div>
      <div style={lbl}>Primary Domain *</div>
      <input
        style={inp(err && !domainName)}
        placeholder="example.com"
        value={domainName}
        onChange={e => { setDomainName(e.target.value); emit(e.target.value, sanInput, validationMethod) }}
      />
      <div style={lbl}>Subject Alternative Names</div>
      <input
        style={inp(false)}
        placeholder="*.example.com, www.example.com"
        value={sanInput}
        onChange={e => { setSanInput(e.target.value); emit(domainName, e.target.value, validationMethod) }}
      />
      <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', marginTop: 2 }}>Comma-separated. Leave blank if none.</div>
      <div style={lbl}>Validation Method</div>
      <select
        style={inp(false)}
        value={validationMethod}
        onChange={e => {
          const m = e.target.value as 'DNS' | 'EMAIL'
          setValidationMethod(m)
          emit(domainName, sanInput, m)
        }}
      >
        <option value="DNS">DNS (recommended)</option>
        <option value="EMAIL">Email</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Register AcmForm in `CreateModal.tsx`**

Read `CreateModal.tsx` first to see the exact existing structure. Then make these four additions:

**Import** (alongside other form imports):
```ts
import { AcmForm } from './AcmForm'
```

**TITLES object** (add entry):
```ts
acm: 'New ACM Certificate',
```

**RESOURCE_TO_NODE_TYPE object** (add entry):
```ts
acm: 'acm' as const,
```

**validateParams switch** (add case):
```ts
case 'acm': return !!(params as AcmParams).domainName
```

**JSX form rendering** (add alongside other `{activeCreate.resource === '...' && <Form>}` lines):
```tsx
{activeCreate.resource === 'acm' && <AcmForm onChange={handleChange} showErrors={showErrors} />}
```

Also add `AcmParams` to the existing import from `'../../types/create'` if not already there.

- [ ] **Step 4: Add `acm` label to `NodeContextMenu.tsx`**

In `RESOURCE_LABELS`, add:
```ts
acm: 'ACM Certificate',
cloudfront: 'CloudFront Distribution',
```

- [ ] **Step 5: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
```

Expected: no real errors

- [ ] **Step 6: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/modals/AcmForm.tsx src/renderer/components/modals/CreateModal.tsx src/renderer/components/canvas/NodeContextMenu.tsx
git commit -m "feat: add AcmForm create modal"
```

---

## Chunk 3: CloudFront CRUD

### Task 7: CloudFrontForm create modal

**Files:**
- Create: `src/renderer/components/modals/CloudFrontForm.tsx`
- Modify: `src/renderer/components/modals/CreateModal.tsx`

- [ ] **Step 1: Read CreateModal.tsx and AlbForm.tsx**

Read both files to understand the create form integration pattern.

- [ ] **Step 2: Create `src/renderer/components/modals/CloudFrontForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudFrontParams, CloudFrontOrigin } from '../../types/create'
import { useCloudStore } from '../../store/cloud'

interface Props { onChange: (p: CloudFrontParams) => void; showErrors?: boolean }

const inp = (err: boolean): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)',
  border: `1px solid ${err ? '#ff5f57' : 'var(--cb-border)'}`,
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)',
  fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = {
  fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8,
}
const btnSmall: React.CSSProperties = {
  background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)',
  borderRadius: 2, padding: '2px 8px', color: 'var(--cb-text-secondary)',
  fontFamily: 'monospace', fontSize: 9, cursor: 'pointer', marginTop: 4,
}

export function CloudFrontForm({ onChange, showErrors }: Props) {
  const nodes = useCloudStore((s) => s.nodes)
  const acmCerts = nodes.filter((n) => n.type === 'acm' && n.status === 'running')
  const s3Nodes  = nodes.filter((n) => n.type === 's3')
  const albNodes = nodes.filter((n) => n.type === 'alb')

  const [comment, setComment] = useState('')
  const [origins, setOrigins] = useState<CloudFrontOrigin[]>([{ id: 'origin-1', domainName: '' }])
  const [defaultRootObject, setDefaultRootObject] = useState('index.html')
  const [certArn, setCertArn] = useState('')
  const [priceClass, setPriceClass] = useState<CloudFrontParams['priceClass']>('PriceClass_All')
  const err = showErrors ?? false

  const emit = (
    c: string, o: CloudFrontOrigin[], root: string, cert: string,
    pc: CloudFrontParams['priceClass'],
  ) => {
    onChange({ resource: 'cloudfront', comment: c, origins: o, defaultRootObject: root, certArn: cert || undefined, priceClass: pc })
  }

  const addOrigin = () => {
    const next = [...origins, { id: `origin-${origins.length + 1}`, domainName: '' }]
    setOrigins(next); emit(comment, next, defaultRootObject, certArn, priceClass)
  }

  const updateOrigin = (i: number, field: keyof CloudFrontOrigin, val: string) => {
    const next = origins.map((o, idx) => idx === i ? { ...o, [field]: val } : o)
    setOrigins(next); emit(comment, next, defaultRootObject, certArn, priceClass)
  }

  const removeOrigin = (i: number) => {
    const next = origins.filter((_, idx) => idx !== i)
    setOrigins(next); emit(comment, next, defaultRootObject, certArn, priceClass)
  }

  const originOptions = [
    ...s3Nodes.map((n) => ({ label: `S3: ${n.label}`, domain: `${n.id}.s3.amazonaws.com` })),
    ...albNodes.map((n) => ({ label: `ALB: ${n.label}`, domain: (n.metadata.dnsName as string) ?? '' })),
  ]

  return (
    <div>
      <div style={lbl}>Name / Comment *</div>
      <input
        style={inp(err && !comment)}
        placeholder="prod-cdn"
        value={comment}
        onChange={e => { setComment(e.target.value); emit(e.target.value, origins, defaultRootObject, certArn, priceClass) }}
      />

      <div style={lbl}>Origins *</div>
      {origins.map((o, i) => (
        <div key={i} style={{ marginBottom: 6, padding: '6px', background: 'var(--cb-bg-elevated)', borderRadius: 3 }}>
          <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', marginBottom: 2 }}>ORIGIN {i + 1}</div>
          <select
            style={{ ...inp(err && !o.domainName), marginBottom: 3 }}
            value={o.domainName}
            onChange={e => updateOrigin(i, 'domainName', e.target.value)}
          >
            <option value="">— select or type below —</option>
            {originOptions.map((opt) => (
              <option key={opt.domain} value={opt.domain}>{opt.label}</option>
            ))}
          </select>
          <input
            style={inp(err && !o.domainName)}
            placeholder="custom-origin.example.com"
            value={o.domainName}
            onChange={e => updateOrigin(i, 'domainName', e.target.value)}
          />
          {origins.length > 1 && (
            <button style={btnSmall} onClick={() => removeOrigin(i)}>Remove</button>
          )}
        </div>
      ))}
      <button style={btnSmall} onClick={addOrigin}>+ Add origin</button>

      <div style={lbl}>Default Root Object</div>
      <input
        style={inp(false)}
        value={defaultRootObject}
        onChange={e => { setDefaultRootObject(e.target.value); emit(comment, origins, e.target.value, certArn, priceClass) }}
      />

      <div style={lbl}>ACM Certificate</div>
      <select
        style={inp(false)}
        value={certArn}
        onChange={e => { setCertArn(e.target.value); emit(comment, origins, defaultRootObject, e.target.value, priceClass) }}
      >
        <option value="">Use default CloudFront certificate</option>
        {acmCerts.map((c) => (
          <option key={c.id} value={c.id}>{c.label} ({c.id.slice(-8)})</option>
        ))}
      </select>

      <div style={lbl}>Price Class</div>
      <select
        style={inp(false)}
        value={priceClass}
        onChange={e => {
          const pc = e.target.value as CloudFrontParams['priceClass']
          setPriceClass(pc)
          emit(comment, origins, defaultRootObject, certArn, pc)
        }}
      >
        <option value="PriceClass_All">All edge locations (best performance)</option>
        <option value="PriceClass_100">North America + Europe only</option>
        <option value="PriceClass_200">Most regions</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 3: Register CloudFrontForm in CreateModal.tsx**

`CreateModal.tsx` currently calls `buildCommands(paramsRef.current!)` then `window.cloudblocks.runCli(commands)` inside `handleRun`. CloudFront bypasses this path and calls `window.cloudblocks.createCloudFront(params)` via SDK.

**Import** (alongside other form imports):
```ts
import { CloudFrontForm } from './CloudFrontForm'
import type { CloudFrontParams } from '../../types/create'
```

**TITLES object** (add entry):
```ts
cloudfront: 'New CloudFront Distribution',
```

**RESOURCE_TO_NODE_TYPE object** (add entry):
```ts
cloudfront: 'cloudfront' as const,
```

**validateParams switch** (add case before `default`):
```ts
case 'cloudfront': return !!(params as CloudFrontParams).comment && (params as CloudFrontParams).origins.length > 0
```

**JSX form rendering** (add after the AlbForm line):
```tsx
{activeCreate.resource === 'cloudfront' && <CloudFrontForm onChange={handleChange} showErrors={showErrors} />}
```

**handleChange** — the `buildCommands` call will throw for cloudfront since there's no CLI case; the existing try/catch already suppresses errors. Add a preview line for cloudfront before the try block:
```ts
function handleChange(params: CreateParams): void {
  paramsRef.current = params
  if (params.resource === 'cloudfront') {
    setCommandPreview(['// SDK: cloudfront:create (no CLI preview)'])
    return
  }
  try {
    const preview = buildCommands(params).map(argv => 'aws ' + argv.join(' '))
    setCommandPreview(preview)
  } catch {
    // incomplete form — ignore preview update
  }
}
```

**handleRun** — add a CloudFront branch before `const commands = buildCommands(...)`:
```ts
// CloudFront uses SDK, not CLI
if (paramsRef.current.resource === 'cloudfront') {
  window.cloudblocks.createCloudFront(paramsRef.current as CloudFrontParams)
    .then((result) => {
      if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
      pendingIdRef.current = null
      if (result.code === 0) {
        setCommandPreview([])
        setActiveCreate(null)
        window.cloudblocks.startScan()
      }
    })
    .catch(() => {
      if (pendingIdRef.current) removePendingNode(pendingIdRef.current)
      pendingIdRef.current = null
    })
  return
}

const commands = buildCommands(paramsRef.current!)
// ... rest unchanged
```

- [ ] **Step 4: Typecheck + full suite**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: no errors, all pass

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/modals/CloudFrontForm.tsx src/renderer/components/modals/CreateModal.tsx
git commit -m "feat: add CloudFrontForm create modal"
```

---

### Task 8: CloudFrontEditForm + Inspector CloudFront/ACM handling

**Files:**
- Create: `src/renderer/components/modals/CloudFrontEditForm.tsx`
- Modify: `src/renderer/components/modals/EditModal.tsx`
- Modify: `src/renderer/types/edit.ts`
- Modify: `src/renderer/components/Inspector.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Read the files**

Read `EditModal.tsx`, `src/renderer/types/edit.ts`, `Inspector.tsx`, `App.tsx`.

- [ ] **Step 2: Add `CloudFrontEditParams` to `src/renderer/types/edit.ts`**

Note: `CloudFrontEditParams` is already defined in `create.ts`. Rather than duplicating, import it from there in edit.ts, OR just reference it from `create.ts` at usage sites. The cleaner approach: leave `CloudFrontEditParams` in `create.ts` (it's defined there already from Task 5) and don't add it to `edit.ts` — CloudFront edit goes through `window.cloudblocks.updateCloudFront()` not `buildEditCommands()`. So no change needed to `edit.ts`.

- [ ] **Step 3: Create `src/renderer/components/modals/CloudFrontEditForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { CloudFrontEditParams } from '../../types/create'
import type { CloudNode } from '../../types/cloud'
import { useCloudStore } from '../../store/cloud'

interface Props {
  node: CloudNode
  onChange: (p: CloudFrontEditParams) => void
}

const inp = (): React.CSSProperties => ({
  width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)',
  borderRadius: 3, padding: '3px 6px', color: 'var(--cb-text-primary)',
  fontFamily: 'monospace', fontSize: 10, boxSizing: 'border-box' as const,
})
const lbl: React.CSSProperties = {
  fontSize: 9, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 2, marginTop: 8,
}

export function CloudFrontEditForm({ node, onChange }: Props) {
  const nodes    = useCloudStore((s) => s.nodes)
  const acmCerts = nodes.filter((n) => n.type === 'acm' && n.status === 'running')

  const [comment, setComment] = useState((node.metadata.comment as string) ?? node.label)
  const [defaultRootObject, setDefaultRootObject] = useState((node.metadata.defaultRootObject as string) ?? '')
  const [certArn, setCertArn] = useState((node.metadata.certArn as string) ?? '')
  const [priceClass, setPriceClass] = useState<CloudFrontEditParams['priceClass']>(
    (node.metadata.priceClass as CloudFrontEditParams['priceClass']) ?? 'PriceClass_All',
  )

  const emit = (c: string, root: string, cert: string, pc: CloudFrontEditParams['priceClass']) => {
    onChange({ resource: 'cloudfront', comment: c, defaultRootObject: root, certArn: cert || undefined, priceClass: pc })
  }

  return (
    <div>
      <div style={lbl}>Name / Comment</div>
      <input style={inp()} value={comment} onChange={e => { setComment(e.target.value); emit(e.target.value, defaultRootObject, certArn, priceClass) }} />
      <div style={lbl}>Default Root Object</div>
      <input style={inp()} value={defaultRootObject} onChange={e => { setDefaultRootObject(e.target.value); emit(comment, e.target.value, certArn, priceClass) }} />
      <div style={lbl}>ACM Certificate</div>
      <select style={inp()} value={certArn} onChange={e => { setCertArn(e.target.value); emit(comment, defaultRootObject, e.target.value, priceClass) }}>
        <option value="">Use default CloudFront certificate</option>
        {acmCerts.map((c) => (
          <option key={c.id} value={c.id}>{c.label} ({c.id.slice(-8)})</option>
        ))}
      </select>
      <div style={lbl}>Price Class</div>
      <select style={inp()} value={priceClass} onChange={e => {
        const pc = e.target.value as CloudFrontEditParams['priceClass']
        setPriceClass(pc); emit(comment, defaultRootObject, certArn, pc)
      }}>
        <option value="PriceClass_All">All edge locations</option>
        <option value="PriceClass_100">North America + Europe only</option>
        <option value="PriceClass_200">Most regions</option>
      </select>
    </div>
  )
}
```

- [ ] **Step 4: Integrate CloudFrontEditForm into EditModal.tsx**

**Imports** (add after existing form imports):
```ts
import { CloudFrontEditForm } from './CloudFrontEditForm'
import type { CloudFrontEditParams } from '../../types/create'
```

**RESOURCE_LABELS** (add entry):
```ts
cloudfront: 'CloudFront Distribution',
```

**handleChange** — add cloudfront branch at the top (before `buildEditCommands`):
```ts
const handleChange = (params: EditParams) => {
  paramsRef.current = params
  if (node.type === 'cloudfront') {
    setCommandPreview(['// SDK: cloudfront:update'])
    return
  }
  const cmds = buildEditCommands(node, params)
  setCommandPreview(cmds.map(argv => 'aws ' + argv.join(' ')))
}
```

**handleRun** — add cloudfront branch at the top of the function (before `buildEditCommands`):
```ts
const handleRun = async () => {
  if (!paramsRef.current) { setShowErrors(true); return }

  if (node.type === 'cloudfront') {
    setIsRunning(true)
    try {
      const result = await window.cloudblocks.updateCloudFront(
        node.id,
        paramsRef.current as unknown as CloudFrontEditParams,
      )
      if (result.code === 0) {
        setCommandPreview([])
        onClose()
        await window.cloudblocks.startScan()
      }
    } finally {
      setIsRunning(false)
    }
    return
  }

  const cmds = buildEditCommands(node, paramsRef.current)
  // ... rest unchanged
}
```

**JSX form rendering** (add after the AlbEditForm line):
```tsx
{node.type === 'cloudfront' && (
  <CloudFrontEditForm
    node={node}
    onChange={(p) => { paramsRef.current = p as unknown as EditParams }}
  />
)}
```

- [ ] **Step 5: Update CloudFront delete in App.tsx**

`handleDeleteConfirm` in `App.tsx` currently reads:
```ts
const handleDeleteConfirm = (node: CloudNode, opts: DeleteOptions) => {
  const commands = buildDeleteCommands(node, opts)
  setCommandPreview(commands.map(argv => 'aws ' + argv.join(' ')))
  setPendingCommand(commands)
  setDeleteTarget(null)
}
```

Replace it with:
```ts
const handleDeleteConfirm = (node: CloudNode, opts: DeleteOptions) => {
  // CloudFront delete uses SDK (disable → poll → delete ETag cycle in main process)
  if (node.type === 'cloudfront') {
    setDeleteTarget(null)
    window.cloudblocks.deleteCloudFront(node.id).then(() => {
      window.cloudblocks.startScan()
    })
    return
  }
  const commands = buildDeleteCommands(node, opts)
  setCommandPreview(commands.map(argv => 'aws ' + argv.join(' ')))
  setPendingCommand(commands)
  setDeleteTarget(null)
}
```

- [ ] **Step 6: Update `onQuickAction` in Inspector.tsx and App.tsx**

In `Inspector.tsx`:
- Change `onQuickAction` prop type to:
  ```ts
  onQuickAction: (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }) => void
  ```
- For `cloudfront` nodes, add quick action section:
  ```tsx
  {node.type === 'cloudfront' && (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Quick Actions</div>
      <InvalidateCacheAction node={node} onQuickAction={onQuickAction} />
    </div>
  )}
  ```
  Implement `InvalidateCacheAction` as an inline component within the file:
  ```tsx
  function InvalidateCacheAction({ node, onQuickAction }: { node: CloudNode; onQuickAction: Function }) {
    const [path, setPath] = React.useState('/*')
    return (
      <div>
        <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', marginBottom: 3 }}>INVALIDATE PATH</div>
        <input
          value={path}
          onChange={e => setPath(e.target.value)}
          style={{ width: '100%', background: 'var(--cb-bg-panel)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '2px 4px', color: 'var(--cb-text-primary)', fontFamily: 'monospace', fontSize: 9, boxSizing: 'border-box' as const }}
        />
        <button
          onClick={() => onQuickAction(node, 'invalidate', { path })}
          style={{ marginTop: 4, width: '100%', background: 'var(--cb-bg-elevated)', border: '1px solid #febc2e', borderRadius: 2, padding: '3px 0', color: '#febc2e', fontFamily: 'monospace', fontSize: 9, cursor: 'pointer' }}
        >
          Invalidate
        </button>
      </div>
    )
  }
  ```

- For `acm` nodes, suppress the edit button (check `node.type !== 'acm'` before rendering edit button).

- Also show CNAME records for pending ACM certs:
  ```tsx
  {node.type === 'acm' && node.status === 'pending' && (node.metadata.cnameRecords as Array<{name:string;value:string}>).length > 0 && (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>DNS Validation Records</div>
      {(node.metadata.cnameRecords as Array<{name:string;value:string}>).map((r, i) => (
        <div key={i} style={{ marginBottom: 6, fontSize: 8, wordBreak: 'break-all' }}>
          <div style={{ color: 'var(--cb-text-muted)' }}>NAME</div>
          <div style={{ color: 'var(--cb-text-secondary)', marginBottom: 2 }}>{r.name}</div>
          <div style={{ color: 'var(--cb-text-muted)' }}>VALUE</div>
          <div style={{ color: 'var(--cb-text-secondary)' }}>{r.value}</div>
          <button
            onClick={() => navigator.clipboard.writeText(`${r.name} CNAME ${r.value}`)}
            style={{ marginTop: 3, background: 'var(--cb-bg-elevated)', border: '1px solid var(--cb-border)', borderRadius: 2, padding: '2px 6px', color: 'var(--cb-text-secondary)', fontFamily: 'monospace', fontSize: 8, cursor: 'pointer' }}
          >
            Copy CNAME
          </button>
        </div>
      ))}
    </div>
  )}
  ```

In `App.tsx`:
- Update `handleQuickAction` to handle `'invalidate'`:
  ```ts
  const handleQuickAction = (node: CloudNode, action: 'stop' | 'start' | 'reboot' | 'invalidate', meta?: { path?: string }) => {
    if (action === 'invalidate') {
      window.cloudblocks.invalidateCloudFront(node.id, meta?.path ?? '/*').then(() => {
        window.cloudblocks.startScan()
      })
      return
    }
    const cmds = buildQuickActionCommand(node, action as 'stop' | 'start' | 'reboot')
    setCommandPreview(cmds.map(a => 'aws ' + a.join(' ')))
    setPendingCommand(cmds)
  }
  ```

- [ ] **Step 7: Typecheck + full suite**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: no errors, all pass

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/modals/CloudFrontEditForm.tsx src/renderer/components/modals/EditModal.tsx src/renderer/components/Inspector.tsx src/renderer/src/App.tsx
git commit -m "feat: add CloudFront edit form, inspector quick actions, ACM CNAME display"
```

---

## Chunk 4: Canvas — GlobalZone + resource nodes + topology + graph

### Task 9: GlobalZoneNode, AcmNode, CloudFrontNode custom nodes

**Files:**
- Create: `src/renderer/components/canvas/nodes/GlobalZoneNode.tsx`
- Create: `src/renderer/components/canvas/nodes/AcmNode.tsx`
- Create: `src/renderer/components/canvas/nodes/CloudFrontNode.tsx`

- [ ] **Step 1: Create `GlobalZoneNode.tsx`**

The node acts as a non-interactive container — no handles, not selectable, not draggable. Width and height come from `style` set by the parent:

```tsx
import { NodeProps } from '@xyflow/react'

export function GlobalZoneNode({ data, style }: NodeProps & { style?: React.CSSProperties }) {
  return (
    <div style={{
      width:        '100%',
      height:       '100%',
      border:       '1px dashed var(--cb-border)',
      borderRadius: 4,
      background:   'rgba(255,255,255,0.02)',
      ...style,
    }}>
      <div style={{
        height:     32,
        display:    'flex',
        alignItems: 'center',
        padding:    '0 12px',
        fontSize:   9,
        fontFamily: 'monospace',
        color:      'var(--cb-text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        borderBottom: '1px dashed var(--cb-border)',
      }}>
        🌐 {(data as { label?: string }).label ?? 'Global / Edge'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `AcmNode.tsx`**

Lock icon, green accent for `running`, yellow for `pending`:

```tsx
import type { NodeProps } from '@xyflow/react'
import type { NodeStatus } from '../../../types/cloud'

const STATUS_COLORS: Record<string, string> = {
  running: '#28c840', pending: '#febc2e', error: '#ff5f57', unknown: '#666',
}

interface AcmData { label: string; status: NodeStatus; domain: string }

export function AcmNode({ data, selected }: NodeProps) {
  const d = data as AcmData
  const accent = STATUS_COLORS[d.status] ?? '#666'

  return (
    <div style={{
      width: 150, minHeight: 50, borderRadius: 3, fontFamily: 'monospace',
      border: `1px solid ${selected ? accent : 'var(--cb-border)'}`,
      background: selected ? 'var(--cb-bg-hover)' : 'var(--cb-bg-elevated)',
    }}>
      <div style={{ fontSize: 8, padding: '3px 6px', color: '#27a347', borderBottom: '1px solid var(--cb-border)', display: 'flex', alignItems: 'center', gap: 4 }}>
        🔒 ACM CERTIFICATE
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ fontSize: 9, color: 'var(--cb-text-primary)', wordBreak: 'break-all' }}>{d.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: 7, color: accent }}>{d.status}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `CloudFrontNode.tsx`**

```tsx
import type { NodeProps } from '@xyflow/react'
import type { NodeStatus } from '../../../types/cloud'

const STATUS_COLORS: Record<string, string> = {
  running: '#28c840', pending: '#febc2e', error: '#ff5f57', unknown: '#666',
}

interface CloudFrontData { label: string; status: NodeStatus }

export function CloudFrontNode({ data, selected }: NodeProps) {
  const d = data as CloudFrontData
  const accent = STATUS_COLORS[d.status] ?? '#666'

  return (
    <div style={{
      width: 150, minHeight: 50, borderRadius: 3, fontFamily: 'monospace',
      border: `1px solid ${selected ? '#4a9eff' : 'var(--cb-border)'}`,
      background: selected ? 'var(--cb-bg-hover)' : 'var(--cb-bg-elevated)',
    }}>
      <div style={{ fontSize: 8, padding: '3px 6px', color: '#4a9eff', borderBottom: '1px solid var(--cb-border)', display: 'flex', alignItems: 'center', gap: 4 }}>
        ☁ CLOUDFRONT
      </div>
      <div style={{ padding: '4px 6px' }}>
        <div style={{ fontSize: 9, color: 'var(--cb-text-primary)', wordBreak: 'break-all' }}>{d.label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: 7, color: accent }}>{d.status}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/canvas/nodes/GlobalZoneNode.tsx src/renderer/components/canvas/nodes/AcmNode.tsx src/renderer/components/canvas/nodes/CloudFrontNode.tsx
git commit -m "feat: add GlobalZoneNode, AcmNode, CloudFrontNode React Flow nodes"
```

---

### Task 10: TopologyView GlobalZone layout + GraphView edges

**Files:**
- Modify: `src/renderer/components/canvas/TopologyView.tsx`
- Modify: `src/renderer/components/canvas/GraphView.tsx`

- [ ] **Step 1: Read both files in full**

Read `TopologyView.tsx` and `GraphView.tsx` completely.

- [ ] **Step 2: Update TopologyView.tsx**

Import new node types and add them to `NODE_TYPES`:
```ts
import { GlobalZoneNode } from './nodes/GlobalZoneNode'
import { AcmNode }        from './nodes/AcmNode'
import { CloudFrontNode } from './nodes/CloudFrontNode'

const NODE_TYPES = { resource: ResourceNode, vpc: VpcNode, subnet: SubnetNode, globalzone: GlobalZoneNode, acmnode: AcmNode, cfnode: CloudFrontNode }
```

Add layout constants:
```ts
const GLOBAL_PAD   = 16
const GLOBAL_LABEL = 32
```

In `buildFlowNodes`, update to handle global nodes:

At the top of the function, separate global nodes from regional:
```ts
const globalNodes = cloudNodes.filter((n) => n.region === 'global')
const vpcs = cloudNodes.filter((n) => n.type === 'vpc')
// ... rest of bucketing unchanged
```

Build the GlobalZone container node (only if global nodes exist):
```ts
let vpcY = 40  // default when no global zone

if (globalNodes.length > 0) {
  const GZ_RES_COLS = 4
  const globalRows  = Math.ceil(globalNodes.length / GZ_RES_COLS)
  const globalZoneW = Math.max(400, GLOBAL_PAD * 2 + GZ_RES_COLS * (RES_W + RES_GAP_X))
  const globalZoneH = GLOBAL_LABEL + GLOBAL_PAD + globalRows * (RES_H + RES_GAP_Y) + GLOBAL_PAD

  nodes.push({
    id:       '__global_zone__',
    type:     'globalzone',
    position: { x: 40, y: 40 },
    style:    { width: globalZoneW, height: globalZoneH },
    data:     { label: 'Global / Edge' },
    selectable: false,
    draggable:  false,
  })

  globalNodes.forEach((n, i) => {
    const col = i % GZ_RES_COLS
    const row = Math.floor(i / GZ_RES_COLS)
    const nodeType = n.type === 'acm' ? 'acmnode' : n.type === 'cloudfront' ? 'cfnode' : 'resource'
    nodes.push({
      id:       n.id,
      type:     nodeType,
      parentId: '__global_zone__',
      extent:   'parent',
      position: {
        x: GLOBAL_PAD + col * (RES_W + RES_GAP_X),
        y: GLOBAL_LABEL + GLOBAL_PAD + row * (RES_H + RES_GAP_Y),
      },
      data:     { label: n.label, status: n.status, nodeType: n.type },
      selected: n.id === selectedId,
    })
  })

  vpcY = 40 + globalZoneH + 60
}
```

Update VPC placement to use `vpcY` instead of the hardcoded `y: 40`:
```ts
nodes.push({
  id:       vpc.id,
  type:     'vpc',
  position: { x: vpcX, y: vpcY },  // was: { x: vpcX, y: 40 }
  // ...
})
```

Update `rootResources` placement to account for shifted VPCs. The existing `vpcs.forEach` already computes `vpcH`; add a `maxVpcBottom` tracker alongside it.

Add `let maxVpcBottom = vpcY` before the `vpcs.forEach` block. Then, inside `vpcs.forEach`, add one line immediately after the `nodes.push({ id: vpc.id, ... })` call and before the subnets loop:
```ts
maxVpcBottom = Math.max(maxVpcBottom, vpcY + Math.max(160, vpcH))
```

Full context (search for this block and apply the one-line addition):
```ts
let maxVpcBottom = vpcY  // ← ADD before vpcs.forEach

// Place VPCs, sizing each one from its content
let vpcX = 40
vpcs.forEach((vpc) => {
  // ... existing vpcSubnets, subSizes, vpcW, vpcH computation unchanged ...
  const vpcH = VPC_LABEL + VPC_PAD + maxSubH + VPC_PAD + (directRes.length > 0 ? directSize.h + SUB_GAP : 0)

  nodes.push({
    id:       vpc.id,
    type:     'vpc',
    position: { x: vpcX, y: vpcY },
    style:    { width: vpcW, height: Math.max(160, vpcH) },
    data:     { label: vpc.label, cidr: vpc.metadata.cidr as string | undefined },
  })
  maxVpcBottom = Math.max(maxVpcBottom, vpcY + Math.max(160, vpcH))  // ← ADD this line

  // ... rest of forEach unchanged (subnets, directRes placement, vpcX +=) ...
})
```

Then replace the hardcoded `y: 520` in the `rootResources.forEach` block:
```ts
// BEFORE:
position: { x: 40 + (i % ROOT_COLS) * (RES_W + RES_GAP_X + 40), y: 520 + Math.floor(i / ROOT_COLS) * (RES_H + RES_GAP_Y + 20) },

// AFTER:
position: { x: 40 + (i % ROOT_COLS) * (RES_W + RES_GAP_X + 40), y: maxVpcBottom + 60 + Math.floor(i / ROOT_COLS) * (RES_H + RES_GAP_Y + 20) },
```

- [ ] **Step 3: Update GraphView.tsx to add CloudFront edges**

In `deriveEdges()`, after the existing `parentId`-based edges, add CloudFront origin + cert edges:

```ts
function deriveEdges(nodes: CloudNode[]): Edge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Existing parentId-based edges
  const parentEdges = nodes
    .filter((n) => n.parentId)
    .map((n) => ({
      id:     `${n.parentId}-${n.id}`,
      source: n.parentId!,
      target: n.id,
      type:   'step',
      style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
    }))

  // CloudFront origin edges
  const cfOriginEdges: Edge[] = []
  nodes
    .filter((n) => n.type === 'cloudfront')
    .forEach((cf) => {
      const origins = (cf.metadata.origins as Array<{ id: string; domainName: string }>) ?? []
      origins.forEach((origin) => {
        // Match S3 node: origin domain starts with bucket name + '.'
        const s3Match = nodes.find(
          (n) => n.type === 's3' && origin.domainName.startsWith(n.id + '.'),
        )
        // Match ALB node: origin domain equals ALB dnsName
        const albMatch = nodes.find(
          (n) => n.type === 'alb' && origin.domainName === (n.metadata.dnsName as string),
        )
        const target = s3Match ?? albMatch
        if (target) {
          cfOriginEdges.push({
            id:     `cf-origin-${cf.id}-${target.id}`,
            source: cf.id,
            target: target.id,
            type:   'step',
            style:  { stroke: 'var(--cb-border-strong)', strokeWidth: 1.5 },
            label:  'origin',
          })
        }
      })
    })

  // CloudFront → ACM cert edges (dotted)
  const cfCertEdges: Edge[] = []
  nodes
    .filter((n) => n.type === 'cloudfront' && n.metadata.certArn)
    .forEach((cf) => {
      const cert = byId.get(cf.metadata.certArn as string)
      if (cert) {
        cfCertEdges.push({
          id:     `cf-cert-${cf.id}`,
          source: cf.id,
          target: cert.id,
          type:   'step',
          style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
          label:  'cert',
        })
      }
    })

  return [...parentEdges, ...cfOriginEdges, ...cfCertEdges]
}
```

The existing `GraphView` already calls `deriveEdges(allNodes)` — no change needed there. Make three additions:

**1.** Imports + NODE_TYPES (replace the existing single-entry `NODE_TYPES`):
```ts
import { AcmNode }        from './nodes/AcmNode'
import { CloudFrontNode } from './nodes/CloudFrontNode'

const NODE_TYPES = { resource: ResourceNode, acmnode: AcmNode, cfnode: CloudFrontNode }
```

**2.** Add `toFlowNodeType` helper after the existing `findVpcAncestor` function:
```ts
function toFlowNodeType(nodeType: string): string {
  if (nodeType === 'acm')        return 'acmnode'
  if (nodeType === 'cloudfront') return 'cfnode'
  return 'resource'
}
```

**3.** In the `flowNodes` useMemo (line 71 of the current file), replace:
```ts
type: 'resource',
```
with:
```ts
type: toFlowNodeType(n.type),
```

- [ ] **Step 4: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json 2>&1 | grep "error TS" | grep -v TS6307 | head -20
```

Expected: no errors

- [ ] **Step 5: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/canvas/TopologyView.tsx src/renderer/components/canvas/GraphView.tsx
git commit -m "feat: add GlobalZone topology layout, CloudFront origin + cert graph edges"
```

---

## Done

All tasks complete. Use `superpowers:finishing-a-development-branch` to merge.
