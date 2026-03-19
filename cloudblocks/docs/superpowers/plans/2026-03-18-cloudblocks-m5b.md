# API Gateway v2 (M5b) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AWS API Gateway HTTP APIs (v2) as a full CRUD service — scan, create, edit, delete, plus route management — with container nodes in topology view and Lambda integration edges.

**Architecture:** All reads use `@aws-sdk/client-apigatewayv2` in the main process scanner. All writes use the existing `cli:run` path via `buildCommand.ts` / `buildDeleteCommands.ts` / `buildEditCommands.ts`. No new IPC channels or SDK write handlers needed. API nodes render as containers (like VPC) in topology view with route child nodes inside.

**Tech Stack:** AWS SDK v3 (`@aws-sdk/client-apigatewayv2`), React 18, TypeScript, Electron 32, Zustand 5, Vitest

**Spec:** `docs/superpowers/specs/2026-03-18-cloudblocks-m5b-design.md`

---

## Chunk 1: Data layer — types, client, scan service, scanner wiring

### Task 1: Install SDK package + extend types

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/renderer/types/cloud.ts`
- Modify: `src/main/aws/client.ts`

- [ ] **Step 1: Install the new SDK package**

```bash
npm install @aws-sdk/client-apigatewayv2
```

Expected: package added to `node_modules` and listed in `package.json` dependencies.

- [ ] **Step 2: Write failing type test**

Read `src/renderer/store/__tests__/cloud.test.ts`. Add to the existing `NodeType` describe block (or create a new one):

```ts
it('NodeType includes apigw and apigw-route', () => {
  const types: NodeType[] = ['apigw', 'apigw-route']
  types.forEach(t => expect(t).toBeTruthy())
})
```

Add `import type { NodeType } from '../../types/cloud'` if not already imported.

- [ ] **Step 3: Run test to verify it fails**

```bash
./node_modules/.bin/vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: TypeScript error — `'apigw'` not assignable to `NodeType`.

- [ ] **Step 4: Extend `NodeType` in `src/renderer/types/cloud.ts`**

Read the file. Find the `NodeType` union (currently ends with `| 'cloudfront'`). Append:

```ts
  | 'apigw'
  | 'apigw-route'
```

- [ ] **Step 5: Add `ApiGatewayV2Client` to `src/main/aws/client.ts`**

Read the file. Add the import:

```ts
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2'
```

Add to the `AwsClients` interface:

```ts
apigw: ApiGatewayV2Client
```

Add to the return value of `createClients()`:

```ts
apigw: new ApiGatewayV2Client(config),
```

Uses the standard regional `config` (same region as the active session).

- [ ] **Step 6: Run test to verify it passes**

```bash
./node_modules/.bin/vitest run src/renderer/store/__tests__/cloud.test.ts 2>&1 | tail -10
```

Expected: PASS

- [ ] **Step 7: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass (no regressions).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/renderer/types/cloud.ts src/main/aws/client.ts src/renderer/store/__tests__/cloud.test.ts
git commit -m "feat: install API Gateway v2 SDK, extend NodeType and AwsClients"
```

---

### Task 2: API Gateway scan service

**Files:**
- Create: `src/main/aws/services/apigw.ts`
- Create: `tests/main/aws/services/apigw.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/main/aws/services/apigw.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2'
import { listApis, listRoutes } from '../../../../src/main/aws/services/apigw'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ApiGatewayV2Client

beforeEach(() => mockSend.mockReset())

describe('listApis', () => {
  it('returns apigw CloudNodes for HTTP APIs', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          ApiId: 'abc123',
          Name: 'my-api',
          ProtocolType: 'HTTP',
          ApiEndpoint: 'https://abc123.execute-api.us-east-1.amazonaws.com',
          CorsConfiguration: { AllowOrigins: ['https://example.com'] },
        },
      ],
    })
    const nodes = await listApis(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('abc123')
    expect(nodes[0].type).toBe('apigw')
    expect(nodes[0].label).toBe('my-api')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
    expect(nodes[0].metadata.corsOrigins).toEqual(['https://example.com'])
    expect(nodes[0].metadata.protocolType).toBe('HTTP')
    expect(nodes[0].metadata.endpoint).toBe('https://abc123.execute-api.us-east-1.amazonaws.com')
  })

  it('filters out non-HTTP (WebSocket) APIs', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ ApiId: 'ws1', Name: 'ws-api', ProtocolType: 'WEBSOCKET', ApiEndpoint: '' }],
    })
    const nodes = await listApis(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(0)
  })

  it('returns empty array when no APIs exist', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] })
    const nodes = await listApis(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(0)
  })
})

describe('listRoutes', () => {
  it('returns apigw-route CloudNodes with lambda ARN resolved', async () => {
    // GetRoutes call
    mockSend.mockResolvedValueOnce({
      Items: [{ RouteId: 'r1', RouteKey: 'GET /users', Target: 'integrations/i1' }],
    })
    // GetIntegrations call
    mockSend.mockResolvedValueOnce({
      Items: [{ IntegrationId: 'i1', IntegrationType: 'AWS_PROXY', IntegrationUri: 'arn:aws:lambda:us-east-1:123:function:myFn' }],
    })
    const nodes = await listRoutes(mockClient, 'api1', 'us-east-1')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('api1/routes/r1')
    expect(nodes[0].type).toBe('apigw-route')
    expect(nodes[0].label).toBe('GET /users')
    expect(nodes[0].metadata.apiId).toBe('api1')
    expect(nodes[0].metadata.routeId).toBe('r1')
    expect(nodes[0].metadata.method).toBe('GET')
    expect(nodes[0].metadata.path).toBe('/users')
    expect(nodes[0].metadata.lambdaArn).toBe('arn:aws:lambda:us-east-1:123:function:myFn')
    expect(nodes[0].parentId).toBe('api1')
  })

  it('skips $default route', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ RouteId: 'r2', RouteKey: '$default', Target: undefined }] })
    mockSend.mockResolvedValueOnce({ Items: [] })
    const nodes = await listRoutes(mockClient, 'api1', 'us-east-1')
    expect(nodes).toHaveLength(0)
  })

  it('sets lambdaArn undefined when integration is not AWS_PROXY', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ RouteId: 'r3', RouteKey: 'POST /items', Target: 'integrations/i2' }] })
    mockSend.mockResolvedValueOnce({ Items: [{ IntegrationId: 'i2', IntegrationType: 'HTTP_PROXY', IntegrationUri: 'https://example.com' }] })
    const nodes = await listRoutes(mockClient, 'api1', 'us-east-1')
    expect(nodes[0].metadata.lambdaArn).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails (file missing)**

```bash
./node_modules/.bin/vitest run tests/main/aws/services/apigw.test.ts 2>&1 | tail -10
```

Expected: error — cannot find module `../../../../src/main/aws/services/apigw`.

- [ ] **Step 3: Create `src/main/aws/services/apigw.ts`**

```ts
import {
  ApiGatewayV2Client,
  GetApisCommand,
  GetRoutesCommand,
  GetIntegrationsCommand,
} from '@aws-sdk/client-apigatewayv2'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listApis(
  client: ApiGatewayV2Client,
  region: string,
): Promise<CloudNode[]> {
  const response = await client.send(new GetApisCommand({}))
  const items = response.Items ?? []
  return items
    .filter(api => api.ProtocolType === 'HTTP')
    .map(api => ({
      id:       api.ApiId!,
      type:     'apigw' as const,
      label:    api.Name || api.ApiId!,
      status:   'running' as const,
      region,
      metadata: {
        endpoint:     api.ApiEndpoint ?? '',
        protocolType: 'HTTP',
        corsOrigins:  api.CorsConfiguration?.AllowOrigins ?? [],
      },
      parentId: undefined,
    }))
}

export async function listRoutes(
  client: ApiGatewayV2Client,
  apiId: string,
  region: string,
): Promise<CloudNode[]> {
  const [routesRes, integrationsRes] = await Promise.all([
    client.send(new GetRoutesCommand({ ApiId: apiId })),
    client.send(new GetIntegrationsCommand({ ApiId: apiId })),
  ])

  // Build integration ID → lambda ARN map
  const integrationMap = new Map<string, string>()
  for (const integration of integrationsRes.Items ?? []) {
    if (integration.IntegrationType === 'AWS_PROXY' && integration.IntegrationUri) {
      integrationMap.set(integration.IntegrationId!, integration.IntegrationUri)
    }
  }

  const nodes: CloudNode[] = []
  for (const route of routesRes.Items ?? []) {
    const routeKey = route.RouteKey ?? ''
    if (routeKey === '$default') continue

    const spaceIdx = routeKey.indexOf(' ')
    const method = spaceIdx !== -1 ? routeKey.slice(0, spaceIdx) : routeKey
    const path   = spaceIdx !== -1 ? routeKey.slice(spaceIdx + 1) : '/'

    const target = route.Target
    const integrationId = target?.replace('integrations/', '')
    const lambdaArn = integrationId ? integrationMap.get(integrationId) : undefined

    nodes.push({
      id:       `${apiId}/routes/${route.RouteId}`,
      type:     'apigw-route' as const,
      label:    `${method} ${path}`,
      status:   'running' as const,
      region,
      metadata: {
        apiId,
        routeId:   route.RouteId!,
        method,
        path,
        target,
        lambdaArn,
      },
      parentId: apiId,
    })
  }
  return nodes
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
./node_modules/.bin/vitest run tests/main/aws/services/apigw.test.ts 2>&1 | tail -10
```

Expected: PASS — all tests green.

- [ ] **Step 5: Run full suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/aws/services/apigw.ts tests/main/aws/services/apigw.test.ts
git commit -m "feat: add API Gateway v2 scan service (listApis, listRoutes)"
```

---

### Task 3: Wire scanner

**Files:**
- Modify: `src/main/aws/scanner.ts`

- [ ] **Step 1: Write failing scanner integration test**

Read `src/main/aws/scanner.ts` to understand how existing services are integrated. Look for existing scanner tests in `tests/main/aws/`. Add a test that verifies `apigw` nodes appear in scan results when `listApis` returns data. Use `vi.mock` to mock the `apigw` service module.

In the existing scanner test file (or create `tests/main/aws/scanner.test.ts` if missing), add:

```ts
it('includes apigw and apigw-route nodes in scan results', async () => {
  // Mock listApis to return one API node
  vi.mock('../../../src/main/aws/services/apigw', () => ({
    listApis: vi.fn().mockResolvedValue([{
      id: 'api1', type: 'apigw', label: 'test-api', status: 'running',
      region: 'us-east-1', metadata: { endpoint: '', protocolType: 'HTTP', corsOrigins: [] },
    }]),
    listRoutes: vi.fn().mockResolvedValue([{
      id: 'api1/routes/r1', type: 'apigw-route', label: 'GET /test', status: 'running',
      region: 'us-east-1', metadata: { apiId: 'api1', routeId: 'r1', method: 'GET', path: '/test' },
      parentId: 'api1',
    }]),
  }))
  // ... run scanner.scan() and assert nodes include type 'apigw' and 'apigw-route'
})
```

- [ ] **Step 2: Modify `src/main/aws/scanner.ts`**

Read the current file. Add imports:

```ts
import { listApis, listRoutes } from './services/apigw'
```

Inside the main scan method (where `Promise.all` is called or where services are invoked), add the API Gateway scan. Because `listRoutes` depends on the output of `listApis`, run them sequentially but parallelise route fetching across APIs:

```ts
const apiNodes = await listApis(this.clients.apigw, this.region)
const routeNodes = (
  await Promise.all(apiNodes.map(api => listRoutes(this.clients.apigw, api.id, this.region)))
).flat()
// Add apiNodes and routeNodes to the results array
```

Place this after the existing parallel scan `Promise.all` completes so it does not block other scans.

- [ ] **Step 3: Run full test suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/main/aws/scanner.ts
git commit -m "feat: wire API Gateway v2 scan into scanner"
```

---

## Chunk 2: Write layer — params types and CLI command builders

### Task 4: Extend create/edit param types + build command cases

**Files:**
- Modify: `src/renderer/types/create.ts`
- Modify: `src/renderer/types/edit.ts`
- Modify: `src/renderer/utils/buildCommand.ts`
- Modify: `src/renderer/utils/buildDeleteCommands.ts`
- Modify: `src/renderer/utils/buildEditCommands.ts`

- [ ] **Step 1: Write failing param type tests**

Read `src/renderer/store/__tests__/` to find where create/edit params are tested (or where `buildCommand` is tested). Add:

```ts
it('buildCommand handles apigw create', () => {
  const params: ApigwParams = { resource: 'apigw', name: 'my-api', corsOrigins: ['https://a.com'] }
  const cmd = buildCommand(params)
  expect(cmd).toContain('create-api')
  expect(cmd).toContain('--name')
  expect(cmd).toContain('my-api')
  expect(cmd).toContain('--cors-configuration')
})

it('buildCommand handles apigw-route create', () => {
  const params: ApigwRouteParams = { resource: 'apigw-route', apiId: 'abc', method: 'GET', path: '/users' }
  const cmd = buildCommand(params)
  expect(cmd).toContain('create-route')
  expect(cmd).toContain('--api-id')
  expect(cmd).toContain('--route-key')
  expect(cmd).toContain('GET /users')
})

it('buildDeleteCommands handles apigw', () => {
  const node = { id: 'abc', type: 'apigw', metadata: {} } as CloudNode
  const cmds = buildDeleteCommands(node)
  expect(cmds[0]).toContain('delete-api')
  expect(cmds[0]).toContain('--api-id')
})

it('buildDeleteCommands handles apigw-route', () => {
  const node = { id: 'abc/routes/r1', type: 'apigw-route', metadata: { apiId: 'abc', routeId: 'r1' } } as CloudNode
  const cmds = buildDeleteCommands(node)
  expect(cmds[0]).toContain('delete-route')
  expect(cmds[0]).toContain('--api-id')
  expect(cmds[0]).toContain('--route-id')
})

it('buildEditCommands handles apigw', () => {
  const params: ApigwEditParams = { resource: 'apigw', apiId: 'abc', name: 'new-name', corsOrigins: [] }
  const cmds = buildEditCommands(params)
  expect(cmds[0]).toContain('update-api')
  expect(cmds[0]).toContain('--api-id')
  expect(cmds[0]).toContain('--name')
})
```

- [ ] **Step 2: Add `ApigwParams` and `ApigwRouteParams` to `src/renderer/types/create.ts`**

Read the file. Add before the `CreateParams` union:

```ts
export interface ApigwParams {
  resource: 'apigw'
  name: string
  corsOrigins: string[]
}

export interface ApigwRouteParams {
  resource: 'apigw-route'
  apiId: string
  method: string
  path: string
}
```

Extend the `CreateParams` union to include `| ApigwParams | ApigwRouteParams`.

- [ ] **Step 3: Add `ApigwEditParams` to `src/renderer/types/edit.ts`**

Read the file. Add before the `EditParams` union:

```ts
export interface ApigwEditParams {
  resource: 'apigw'
  apiId: string
  name: string
  corsOrigins: string[]
}
```

Extend the `EditParams` union to include `| ApigwEditParams`.

- [ ] **Step 4: Add `apigw` and `apigw-route` cases to `src/renderer/utils/buildCommand.ts`**

Read the file. Add cases for the two new resources:

```ts
case 'apigw': {
  const p = params as ApigwParams
  const args = ['apigatewayv2', 'create-api', '--name', p.name, '--protocol-type', 'HTTP']
  if (p.corsOrigins.length > 0) {
    args.push('--cors-configuration',
      `AllowOrigins=${p.corsOrigins.join(',')},AllowMethods=*,AllowHeaders=*`)
  }
  return args
}
case 'apigw-route': {
  const p = params as ApigwRouteParams
  return [
    'apigatewayv2', 'create-route',
    '--api-id', p.apiId,
    '--route-key', `${p.method} ${p.path}`,
  ]
}
```

Import `ApigwParams` and `ApigwRouteParams` from `../types/create`.

- [ ] **Step 5: Add `apigw` and `apigw-route` cases to `src/renderer/utils/buildDeleteCommands.ts`**

Read the file. Add cases:

```ts
case 'apigw':
  return [['apigatewayv2', 'delete-api', '--api-id', node.id]]
case 'apigw-route':
  return [[
    'apigatewayv2', 'delete-route',
    '--api-id', node.metadata.apiId as string,
    '--route-id', node.metadata.routeId as string,
  ]]
```

- [ ] **Step 6: Add `apigw` case to `src/renderer/utils/buildEditCommands.ts`**

Read the file. Add case:

```ts
case 'apigw': {
  const p = params as ApigwEditParams
  const args = ['apigatewayv2', 'update-api', '--api-id', p.apiId, '--name', p.name]
  if (p.corsOrigins.length > 0) {
    args.push('--cors-configuration',
      `AllowOrigins=${p.corsOrigins.join(',')},AllowMethods=*,AllowHeaders=*`)
  }
  return [args]
}
```

Import `ApigwEditParams` from `../types/edit`.

- [ ] **Step 7: Run tests**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/types/create.ts src/renderer/types/edit.ts \
  src/renderer/utils/buildCommand.ts src/renderer/utils/buildDeleteCommands.ts \
  src/renderer/utils/buildEditCommands.ts
git commit -m "feat: add ApigwParams types and CLI build-command cases"
```

---

## Chunk 3: Canvas node components

### Task 5: ApigwRouteNode component

**Files:**
- Create: `src/renderer/components/canvas/nodes/ApigwRouteNode.tsx`

- [ ] **Step 1: Read an existing compact node component for reference**

Read `src/renderer/components/canvas/nodes/` to find a small node (e.g. `SubnetNode.tsx` or `IgwNode.tsx`) for reference on structure.

- [ ] **Step 2: Create `ApigwRouteNode.tsx`**

The component receives a `CloudNode` (type `apigw-route`) via React Flow's `NodeProps`. It renders as a compact row:

```tsx
import React from 'react'
import type { NodeProps } from 'reactflow'
import type { CloudNode } from '../../../types/cloud'

const METHOD_COLORS: Record<string, string> = {
  GET:    'var(--cb-green)',
  POST:   'var(--cb-blue)',
  PUT:    'var(--cb-orange)',
  DELETE: 'var(--cb-red)',
  PATCH:  'var(--cb-yellow)',
  ANY:    'var(--cb-text-muted)',
}

export default function ApigwRouteNode({ data }: NodeProps<CloudNode>) {
  const method = data.metadata.method as string
  const path   = data.metadata.path as string
  const hasLambda = Boolean(data.metadata.lambdaArn)
  const color  = METHOD_COLORS[method] ?? 'var(--cb-text-muted)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 8px',
      background: 'var(--cb-surface)',
      border: '1px solid var(--cb-border)',
      borderRadius: 4,
      fontSize: 11,
      cursor: 'pointer',
      minWidth: 160,
    }}>
      <span style={{
        background: color, color: 'var(--cb-bg)',
        borderRadius: 3, padding: '1px 5px',
        fontWeight: 700, fontSize: 10,
        flexShrink: 0,
      }}>{method}</span>
      <span style={{ color: 'var(--cb-text-muted)', fontFamily: 'monospace', flexGrow: 1 }}>
        {path}
      </span>
      {hasLambda && (
        <span title="Lambda integration" style={{ color: 'var(--cb-text-muted)', fontSize: 10 }}>λ</span>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: no errors for the new file.

---

### Task 6: ApigwNode container component

**Files:**
- Create: `src/renderer/components/canvas/nodes/ApigwNode.tsx`

- [ ] **Step 1: Read `VpcNode.tsx` for container node pattern**

Read `src/renderer/components/canvas/nodes/VpcNode.tsx` (or equivalent). Note how it renders a header bar and allows children via React Flow's `parentNode` mechanism.

- [ ] **Step 2: Create `ApigwNode.tsx`**

```tsx
import React from 'react'
import type { NodeProps } from 'reactflow'
import type { CloudNode } from '../../../types/cloud'

export default function ApigwNode({ data, selected }: NodeProps<CloudNode>) {
  const endpoint = data.metadata.endpoint as string
  const corsOrigins = data.metadata.corsOrigins as string[]

  return (
    <div style={{
      border: `1px solid ${selected ? 'var(--cb-accent)' : 'var(--cb-border-strong)'}`,
      borderRadius: 6,
      background: 'rgba(255,255,255,0.02)',
      minWidth: 240,
      minHeight: 80,
    }}>
      {/* Header bar */}
      <div style={{
        height: 32,
        background: 'var(--cb-surface-raised)',
        borderBottom: '1px solid var(--cb-border)',
        borderRadius: '6px 6px 0 0',
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 6,
      }}>
        <span style={{ fontSize: 12, color: 'var(--cb-text-muted)' }}>⚡</span>
        <span style={{ fontSize: 11, color: 'var(--cb-text)', fontWeight: 600 }}>
          {data.label}
        </span>
        {corsOrigins.length > 0 && (
          <span style={{ fontSize: 9, color: 'var(--cb-text-muted)', marginLeft: 'auto' }}>
            CORS
          </span>
        )}
      </div>
      {/* Children rendered by React Flow's parentNode mechanism — no inner content needed */}
    </div>
  )
}
```

- [ ] **Step 3: Confirm TypeScript compiles**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/canvas/nodes/ApigwNode.tsx \
        src/renderer/components/canvas/nodes/ApigwRouteNode.tsx
git commit -m "feat: add ApigwNode container and ApigwRouteNode components"
```

---

## Chunk 4: Forms

### Task 7: ApigwForm (create API)

**Files:**
- Create: `src/renderer/components/modals/ApigwForm.tsx`

- [ ] **Step 1: Read an existing form for pattern**

Read `src/renderer/components/modals/AcmForm.tsx` or `src/renderer/components/modals/CloudFrontForm.tsx` to understand the prop signature, submit handler shape, and multi-row input pattern.

- [ ] **Step 2: Create `ApigwForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { ApigwParams } from '../../types/create'

interface Props {
  onSubmit: (params: ApigwParams) => void
  onCancel: () => void
}

export default function ApigwForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [origins, setOrigins] = useState<string[]>([''])

  const addOrigin = () => setOrigins(o => [...o, ''])
  const removeOrigin = (i: number) => setOrigins(o => o.filter((_, idx) => idx !== i))
  const setOrigin = (i: number, val: string) =>
    setOrigins(o => o.map((v, idx) => (idx === i ? val : v)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      resource: 'apigw',
      name: name.trim(),
      corsOrigins: origins.map(o => o.trim()).filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Name *</label>
      <input value={name} onChange={e => setName(e.target.value)} required placeholder="my-api" />

      <label>CORS Origins</label>
      {origins.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          <input
            value={o}
            onChange={e => setOrigin(i, e.target.value)}
            placeholder="https://example.com"
          />
          <button type="button" onClick={() => removeOrigin(i)} disabled={origins.length === 1}>−</button>
        </div>
      ))}
      <button type="button" onClick={addOrigin}>+ Add Origin</button>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="submit" disabled={!name.trim()}>Create API</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
```

---

### Task 8: ApigwEditForm (edit API)

**Files:**
- Create: `src/renderer/components/modals/ApigwEditForm.tsx`

- [ ] **Step 1: Create `ApigwEditForm.tsx`**

Follows same pattern as `ApigwForm` but pre-fills values from the current node and submits `ApigwEditParams`.

```tsx
import React, { useState } from 'react'
import type { CloudNode } from '../../types/cloud'
import type { ApigwEditParams } from '../../types/edit'

interface Props {
  node: CloudNode
  onSubmit: (params: ApigwEditParams) => void
  onCancel: () => void
}

export default function ApigwEditForm({ node, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(node.label)
  const initOrigins = (node.metadata.corsOrigins as string[]) ?? []
  const [origins, setOrigins] = useState<string[]>(initOrigins.length ? initOrigins : [''])

  const addOrigin = () => setOrigins(o => [...o, ''])
  const removeOrigin = (i: number) => setOrigins(o => o.filter((_, idx) => idx !== i))
  const setOrigin = (i: number, val: string) =>
    setOrigins(o => o.map((v, idx) => (idx === i ? val : v)))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      resource: 'apigw',
      apiId: node.id,
      name: name.trim(),
      corsOrigins: origins.map(o => o.trim()).filter(Boolean),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Name *</label>
      <input value={name} onChange={e => setName(e.target.value)} required />

      <label>CORS Origins</label>
      {origins.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          <input value={o} onChange={e => setOrigin(i, e.target.value)} placeholder="https://example.com" />
          <button type="button" onClick={() => removeOrigin(i)} disabled={origins.length === 1}>−</button>
        </div>
      ))}
      <button type="button" onClick={addOrigin}>+ Add Origin</button>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="submit" disabled={!name.trim()}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
```

---

### Task 9: ApigwRouteForm (create route)

**Files:**
- Create: `src/renderer/components/modals/ApigwRouteForm.tsx`

- [ ] **Step 1: Create `ApigwRouteForm.tsx`**

```tsx
import React, { useState } from 'react'
import type { ApigwRouteParams } from '../../types/create'

interface Props {
  parentId: string  // API ID
  onSubmit: (params: ApigwRouteParams) => void
  onCancel: () => void
}

const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ANY']

export default function ApigwRouteForm({ parentId, onSubmit, onCancel }: Props) {
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/')

  const pathValid = path.startsWith('/')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pathValid) return
    onSubmit({
      resource: 'apigw-route',
      apiId: parentId,
      method,
      path: path.trim(),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>Method</label>
      <select value={method} onChange={e => setMethod(e.target.value)}>
        {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
      </select>

      <label>Path *</label>
      <input
        value={path}
        onChange={e => setPath(e.target.value)}
        required
        placeholder="/users"
        style={{ borderColor: path && !pathValid ? 'var(--cb-red)' : undefined }}
      />
      {path && !pathValid && <span style={{ color: 'var(--cb-red)', fontSize: 11 }}>Path must start with /</span>}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="submit" disabled={!pathValid}>Create Route</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Confirm TypeScript compiles (all three forms)**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/modals/ApigwForm.tsx \
        src/renderer/components/modals/ApigwEditForm.tsx \
        src/renderer/components/modals/ApigwRouteForm.tsx
git commit -m "feat: add ApigwForm, ApigwEditForm, ApigwRouteForm modal components"
```

---

## Chunk 5: Canvas integration — topology, graph, inspector, modals, context menu

### Task 10: TopologyView — container layout + route→lambda edges

**Files:**
- Modify: `src/renderer/components/canvas/TopologyView.tsx`

- [ ] **Step 1: Read the current TopologyView**

Read `src/renderer/components/canvas/TopologyView.tsx` in full. Identify:
- How VPC nodes are laid out (x, y, width, height calculation)
- Where `nodeTypes` is defined or passed to `ReactFlow`
- How existing edges are built

- [ ] **Step 2: Add layout constants**

Add near other layout constants:

```ts
const APIGW_PAD       = 16
const APIGW_HEADER    = 32
const APIGW_ROUTE_H   = 36
const APIGW_ROUTE_GAP = 8
const APIGW_MIN_W     = 240
```

- [ ] **Step 3: Add ApigwNode + ApigwRouteNode to `nodeTypes`**

```ts
import ApigwNode      from './nodes/ApigwNode'
import ApigwRouteNode from './nodes/ApigwRouteNode'

// In nodeTypes object:
apigw:       ApigwNode,
'apigw-route': ApigwRouteNode,
```

- [ ] **Step 4: Add API Gateway container layout**

After VPC layout is computed, add API container layout. For each `apigw` node in `cloudNodes`:

```ts
const apigwNodes = cloudNodes.filter(n => n.type === 'apigw')
let apigwX = vpcRowRightEdge + 60  // append to right of VPC row

for (const api of apigwNodes) {
  const routes = cloudNodes.filter(n => n.type === 'apigw-route' && n.parentId === api.id)
  const labelMaxLen = routes.reduce((max, r) => Math.max(max, r.label.length), api.label.length)
  const w = Math.max(APIGW_MIN_W, labelMaxLen * 7 + APIGW_PAD * 2)
  const h = APIGW_HEADER + APIGW_PAD + routes.length * (APIGW_ROUTE_H + APIGW_ROUTE_GAP) + APIGW_PAD

  // API container node
  rfNodes.push({
    id: api.id, type: 'apigw', data: api,
    position: { x: apigwX, y: vpcY },
    style: { width: w, height: h },
  })

  // Route child nodes
  routes.forEach((route, i) => {
    rfNodes.push({
      id:         route.id,
      type:       'apigw-route',
      data:       route,
      parentNode: api.id,
      extent:     'parent',
      position: {
        x: APIGW_PAD,
        y: APIGW_HEADER + APIGW_PAD + i * (APIGW_ROUTE_H + APIGW_ROUTE_GAP),
      },
      style: { width: w - APIGW_PAD * 2, height: APIGW_ROUTE_H },
    })
  })

  apigwX += w + 60
}
```

- [ ] **Step 5: Add route→lambda edges in topology**

After building all nodes, scan for routes with `lambdaArn`:

```ts
for (const node of cloudNodes.filter(n => n.type === 'apigw-route')) {
  const lambdaArn = node.metadata.lambdaArn as string | undefined
  if (!lambdaArn) continue
  const lambdaNode = cloudNodes.find(n => n.id === lambdaArn || n.metadata?.arn === lambdaArn)
  if (!lambdaNode) continue
  rfEdges.push({
    id:     `route-lambda-${node.id}`,
    source: node.id,
    target: lambdaNode.id,
    type:   'step',
    label:  'integration',
    style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
  })
}
```

- [ ] **Step 6: Confirm TypeScript compiles**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/canvas/TopologyView.tsx
git commit -m "feat: add ApigwNode container layout and route→lambda edges to TopologyView"
```

---

### Task 11: GraphView — register nodes + edges

**Files:**
- Modify: `src/renderer/components/canvas/GraphView.tsx`

- [ ] **Step 1: Read the current GraphView**

Read `src/renderer/components/canvas/GraphView.tsx`. Identify:
- Where `nodeTypes` is defined
- Where `deriveEdges()` or equivalent edge-derivation logic lives

- [ ] **Step 2: Register node types**

Import and register `ApigwNode` and `ApigwRouteNode` in the `nodeTypes` map (same imports as TopologyView).

- [ ] **Step 3: Add edges in `deriveEdges()` or equivalent**

```ts
// route → parent API edge
if (node.type === 'apigw-route') {
  edges.push({
    id:     `apigw-parent-${node.id}`,
    source: node.metadata.apiId as string,
    target: node.id,
    type:   'step',
    style:  { stroke: 'var(--cb-border)', strokeWidth: 1 },
  })
  // route → lambda edge
  const lambdaArn = node.metadata.lambdaArn as string | undefined
  if (lambdaArn) {
    const lambdaNode = nodes.find(n => n.id === lambdaArn || n.metadata?.arn === lambdaArn)
    if (lambdaNode) {
      edges.push({
        id:     `route-lambda-${node.id}`,
        source: node.id,
        target: lambdaNode.id,
        type:   'step',
        label:  'integration',
        style:  { stroke: 'var(--cb-border)', strokeDasharray: '4 2', strokeWidth: 1 },
      })
    }
  }
}
```

- [ ] **Step 4: Confirm TypeScript compiles + run tests**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
./node_modules/.bin/vitest run 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/canvas/GraphView.tsx
git commit -m "feat: register Apigw node types and add route edges to GraphView"
```

---

### Task 12: Inspector — handle apigw and apigw-route

**Files:**
- Modify: `src/renderer/components/Inspector.tsx`

- [ ] **Step 1: Read the current Inspector**

Read `src/renderer/components/Inspector.tsx`. Identify:
- Where node type branching happens (likely a `switch` or series of `if` blocks)
- How metadata fields are rendered
- How edit/delete buttons are wired
- The `onEdit`, `onDelete`, `onQuickAction` prop signatures

- [ ] **Step 2: Add `apigw` Inspector section**

```tsx
case 'apigw': {
  const corsOrigins = node.metadata.corsOrigins as string[]
  return (
    <>
      <Field label="ID"       value={node.id} copyable />
      <Field label="NAME"     value={node.label} />
      <Field label="REGION"   value={node.region} />
      <Field label="STATE"    value={node.status} />
      <Field label="ENDPOINT" value={node.metadata.endpoint as string} copyable />
      <Field label="PROTOCOL" value="HTTP" />
      <Field label="CORS ORIGINS" value={corsOrigins.length ? corsOrigins.join(', ') : '(none)'} />
      <Field label="ROUTES"   value={String(allNodes.filter(n => n.parentId === node.id).length)} />
      <InspectorActions>
        <button onClick={() => onEdit(node)}>Edit</button>
        <button onClick={() => onDelete(node)} className="danger">
          Delete <span className="warn">(deletes all routes)</span>
        </button>
      </InspectorActions>
    </>
  )
}
```

Use whatever `Field`, `InspectorActions`, and styling primitives exist in the current Inspector.

- [ ] **Step 3: Add `apigw-route` Inspector section**

```tsx
case 'apigw-route': {
  const lambdaArn = node.metadata.lambdaArn as string | undefined
  const parentApi = allNodes.find(n => n.id === node.metadata.apiId)
  return (
    <>
      <Field label="ID"     value={node.id} copyable />
      <Field label="ROUTE"  value={node.label} />
      <Field label="METHOD" value={node.metadata.method as string} />
      <Field label="PATH"   value={node.metadata.path as string} />
      <Field label="API"    value={parentApi?.label ?? (node.metadata.apiId as string)} />
      <Field
        label="TARGET"
        value={lambdaArn ?? '(no integration)'}
        copyable={Boolean(lambdaArn)}
      />
      <InspectorActions>
        <button onClick={() => onDelete(node)} className="danger">Delete Route</button>
      </InspectorActions>
    </>
  )
}
```

No edit button for `apigw-route` — delete and recreate is the workflow.

Note: the Inspector needs access to `allNodes` to look up the parent API name and route count. Verify whether `allNodes` is already available as a prop or from the Zustand store; add it if needed.

- [ ] **Step 4: Confirm TypeScript compiles + run tests**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
./node_modules/.bin/vitest run 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Inspector.tsx
git commit -m "feat: add apigw and apigw-route Inspector sections"
```

---

### Task 13: CreateModal + EditModal wiring

**Files:**
- Modify: `src/renderer/components/modals/CreateModal.tsx`
- Modify: `src/renderer/components/modals/EditModal.tsx`

- [ ] **Step 1: Read both modal files**

Read `src/renderer/components/modals/CreateModal.tsx` and `src/renderer/components/modals/EditModal.tsx`. Identify how resource type routing works (likely a `switch` on `resource` or `selectedNode.type`).

- [ ] **Step 2: Wire `ApigwForm` into `CreateModal`**

Import `ApigwForm` and add a case for `'apigw'`:

```tsx
case 'apigw':
  return <ApigwForm onSubmit={handleSubmit} onCancel={onClose} />
```

- [ ] **Step 3: Wire `ApigwRouteForm` into `CreateModal`**

Add a case for `'apigw-route'`. The `parentId` must come from the currently selected node or from a prop passed when "Add Route" is triggered:

```tsx
case 'apigw-route':
  return (
    <ApigwRouteForm
      parentId={parentId ?? selectedNode?.id ?? ''}
      onSubmit={handleSubmit}
      onCancel={onClose}
    />
  )
```

Ensure `CreateModal` accepts an optional `parentId` prop (string) for this case — add to the Props interface if not already there.

- [ ] **Step 4: Wire `ApigwEditForm` into `EditModal`**

Import `ApigwEditForm`. In the node type routing:

```tsx
case 'apigw':
  return <ApigwEditForm node={selectedNode} onSubmit={handleSubmit} onCancel={onClose} />
```

- [ ] **Step 5: Confirm TypeScript compiles**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 6: Run full test suite**

```bash
./node_modules/.bin/vitest run 2>&1 | tail -8
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/modals/CreateModal.tsx \
        src/renderer/components/modals/EditModal.tsx
git commit -m "feat: wire Apigw forms into CreateModal and EditModal"
```

---

### Task 14: CanvasContextMenu — API Gateway entries

**Files:**
- Modify: `src/renderer/components/canvas/CanvasContextMenu.tsx`

- [ ] **Step 1: Read the current CanvasContextMenu**

Read `src/renderer/components/canvas/CanvasContextMenu.tsx`. Identify:
- How menu items are rendered
- How "create resource" actions are triggered
- How node-specific actions are gated

- [ ] **Step 2: Add "New API Gateway" to background (no-node) context menu**

When right-clicking the canvas without a node selected, add:

```tsx
<ContextMenuItem onClick={() => onCreateResource('apigw')}>
  New API Gateway
</ContextMenuItem>
```

- [ ] **Step 3: Add "Add Route" to apigw node context menu**

When right-clicking an `apigw` node:

```tsx
{node.type === 'apigw' && (
  <ContextMenuItem onClick={() => onCreateResource('apigw-route', node.id)}>
    Add Route
  </ContextMenuItem>
)}
```

The `onCreateResource` callback should accept an optional second argument `parentId` and pass it through to the `CreateModal`. Update the callback signature in the parent component (`App.tsx` or canvas container) if needed.

- [ ] **Step 4: Confirm TypeScript compiles + run tests**

```bash
./node_modules/.bin/tsc --noEmit 2>&1 | head -20
./node_modules/.bin/vitest run 2>&1 | tail -8
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/canvas/CanvasContextMenu.tsx
git commit -m "feat: add API Gateway context menu items (New API, Add Route)"
```

---

## Chunk 6: Final validation

### Task 15: End-to-end compile and test pass

- [ ] **Step 1: Full TypeScript check**

```bash
./node_modules/.bin/tsc --noEmit 2>&1
```

Expected: zero errors. Fix any type errors before continuing.

- [ ] **Step 2: Full test suite**

```bash
./node_modules/.bin/vitest run 2>&1
```

Expected: all pass, zero failures.

- [ ] **Step 3: Electron dev build smoke test**

```bash
npm run dev 2>&1 | head -30
```

Expected: no crash on startup. App opens. API Gateway containers visible in topology if scanning a real account with APIs.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: M5b complete — API Gateway v2 CRUD with container topology nodes"
```

---

## Summary of all files changed

| File | Action |
|------|--------|
| `package.json` | Install `@aws-sdk/client-apigatewayv2` |
| `src/main/aws/client.ts` | Add `ApiGatewayV2Client` |
| `src/main/aws/scanner.ts` | Wire `listApis` + `listRoutes` |
| `src/main/aws/services/apigw.ts` | **New** — scan service |
| `src/renderer/types/cloud.ts` | Add `'apigw'`, `'apigw-route'` |
| `src/renderer/types/create.ts` | Add `ApigwParams`, `ApigwRouteParams` |
| `src/renderer/types/edit.ts` | Add `ApigwEditParams` |
| `src/renderer/utils/buildCommand.ts` | Add `apigw`, `apigw-route` cases |
| `src/renderer/utils/buildDeleteCommands.ts` | Add `apigw`, `apigw-route` cases |
| `src/renderer/utils/buildEditCommands.ts` | Add `apigw` case |
| `src/renderer/components/canvas/nodes/ApigwNode.tsx` | **New** — container node |
| `src/renderer/components/canvas/nodes/ApigwRouteNode.tsx` | **New** — route child node |
| `src/renderer/components/canvas/TopologyView.tsx` | Container layout + route→lambda edges |
| `src/renderer/components/canvas/GraphView.tsx` | Register node types + edges |
| `src/renderer/components/Inspector.tsx` | Handle `apigw`, `apigw-route` |
| `src/renderer/components/modals/ApigwForm.tsx` | **New** — create API form |
| `src/renderer/components/modals/ApigwEditForm.tsx` | **New** — edit API form |
| `src/renderer/components/modals/ApigwRouteForm.tsx` | **New** — create route form |
| `src/renderer/components/modals/CreateModal.tsx` | Wire Apigw forms |
| `src/renderer/components/modals/EditModal.tsx` | Wire `ApigwEditForm` |
| `src/renderer/components/canvas/CanvasContextMenu.tsx` | Add API GW menu items |
| `tests/main/aws/services/apigw.test.ts` | **New** — scan service tests |
