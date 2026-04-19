# Cloudblocks — API Gateway v2 (M5b) Design Spec
**Date:** 2026-03-18
**Status:** Approved

## Overview

Add AWS API Gateway HTTP APIs (v2) as a full CRUD service. API Gateway resources are regional. Each HTTP API is rendered as a container node (like VPC) in the topology view, with its routes appearing as child nodes inside. Lambda integration edges are drawn from route nodes to their target Lambda nodes. This is Milestone 5b; ACM + CloudFront were Milestone 5a.

---

## New Node Types

### `apigw` — API Gateway HTTP API

```ts
// CloudNode for API Gateway HTTP API
{
  id:     apiId,          // e.g. "abc123xyz"
  type:   'apigw',
  label:  name || apiId,  // API name or ID fallback
  status: 'running',      // always running when the API exists
  region: currentRegion,
  metadata: {
    endpoint:     string,    // e.g. "https://abc123xyz.execute-api.us-east-1.amazonaws.com"
    protocolType: 'HTTP',
    corsOrigins:  string[],  // AllowOrigins from CORS config, or []
  },
  parentId: undefined,
}
```

**Status mapping:** APIs do not have a lifecycle status — any existing API is `'running'`.

### `apigw-route` — API Gateway Route

```ts
// CloudNode for an individual route
{
  id:     `${apiId}/routes/${routeId}`,   // composite ID
  type:   'apigw-route',
  label:  `${method} ${path}`,            // e.g. "GET /users"
  status: 'running',
  region: currentRegion,
  metadata: {
    apiId:     string,
    routeId:   string,
    method:    string,             // e.g. "GET"
    path:      string,             // e.g. "/users"
    target:    string | undefined, // raw integration target string (e.g. "integrations/xyz")
    lambdaArn: string | undefined, // resolved Lambda ARN if integration type is AWS_PROXY
  },
  parentId: apiId,
}
```

---

## Scanner

New file `src/main/aws/services/apigw.ts`. Uses `@aws-sdk/client-apigatewayv2`:

```ts
import { ApiGatewayV2Client, GetApisCommand, GetRoutesCommand, GetIntegrationsCommand } from '@aws-sdk/client-apigatewayv2'
```

Two exported functions:

### `listApis(client, region): Promise<CloudNode[]>`

- Calls `GetApisCommand({})` — paginate if `NextToken` present
- Filters to `ProtocolType === 'HTTP'` only
- Maps each API to an `apigw` CloudNode
- CORS origins extracted from `api.CorsConfiguration?.AllowOrigins ?? []`
- Endpoint from `api.ApiEndpoint`

### `listRoutes(client, apiId, region): Promise<CloudNode[]>`

- Calls `GetRoutesCommand({ ApiId: apiId })` — paginate if `NextToken` present
- Calls `GetIntegrationsCommand({ ApiId: apiId })` to build an integration map: `Map<integrationId, lambdaArn>`
  - Integration ARN is in `integration.IntegrationUri` when `integration.IntegrationType === 'AWS_PROXY'`
  - Lambda ARN format: `arn:aws:lambda:<region>:<account>:function:<name>`
- For each route:
  - `routeKey` format is `"METHOD /path"` (or `"$default"` — skip `$default` routes)
  - Split on first space to get `method` and `path`
  - `target` from `route.Target` (e.g. `"integrations/abc123"`)
  - `lambdaArn`: look up integration ID extracted from `target` (`target.replace('integrations/', '')`) in the integration map

**In `scanner.ts`:** After existing parallel scan entries, add:

```ts
import { listApis, listRoutes } from './services/apigw'

// In the Promise.all scan:
const apiNodes = await listApis(this.clients.apigw, this.region)
const routeNodes = (
  await Promise.all(apiNodes.map(api => listRoutes(this.clients.apigw, api.id, this.region)))
).flat()
// Append apiNodes and routeNodes to results
```

The API Gateway scan runs sequentially (routes depend on API list) but all `listRoutes` calls per API can run in parallel via `Promise.all`.

---

## Client

Add `ApiGatewayV2Client` to `AwsClients` and `createClients()` in `src/main/aws/client.ts`:

```ts
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2'

// In AwsClients interface:
apigw: ApiGatewayV2Client

// In createClients():
apigw: new ApiGatewayV2Client(config),
```

Uses the standard regional `config` (same region as the active session).

---

## Topology View

API Gateway container nodes (`ApigwNode`) render like `VpcNode` — a container with a header bar. Route nodes (`ApigwRouteNode`) appear inside as children.

**Layout constants:**
```ts
const APIGW_PAD         = 16   // padding inside API container
const APIGW_HEADER      = 32   // height of header bar
const APIGW_ROUTE_H     = 36   // height of each route node
const APIGW_ROUTE_GAP   = 8    // vertical gap between route nodes
const APIGW_MIN_W       = 240  // minimum container width
```

**Container sizing:**
- Width: `max(APIGW_MIN_W, longestRouteLabel * 7 + APIGW_PAD * 2)`
- Height: `APIGW_HEADER + APIGW_PAD + (routeCount * (APIGW_ROUTE_H + APIGW_ROUTE_GAP)) + APIGW_PAD`

**Route node placement inside container:**
- `x`: `APIGW_PAD`
- `y`: `APIGW_HEADER + APIGW_PAD + index * (APIGW_ROUTE_H + APIGW_ROUTE_GAP)`
- Route nodes have `parentId` set to the API node ID and React Flow `parentNode` set accordingly

**Horizontal placement:** API Gateway containers appear in the same horizontal row as VPCs (both are regional resources). They are appended to the right of the VPC row, separated by the same horizontal gap used between VPCs (currently `60px`).

**Vertical placement:** Same `y` as VPC containers (currently `40px` baseline, shifted down if a Global Zone exists from M5a).

**Edges in topology view:** Route → Lambda edges are drawn when `route.metadata.lambdaArn` is set and a Lambda node with that ARN exists in the scanned nodes. Edge style: dotted step edge, `var(--cb-border)`, labelled `'integration'`.

### ApigwNode visual

- Solid border: `1px solid var(--cb-border-strong)`
- Header bar: `⚡ <API name>` in `var(--cb-text)` at 11px, background `var(--cb-surface-raised)`
- Background: `rgba(255,255,255,0.02)`
- Selectable — clicking selects the API node and opens Inspector

### ApigwRouteNode visual

- Compact pill/chip style, height `APIGW_ROUTE_H`
- Left badge: HTTP method in a coloured chip (GET=green, POST=blue, PUT=orange, DELETE=red, PATCH=yellow, ANY=grey)
- Right text: path in `var(--cb-text-muted)` monospace
- If `lambdaArn` set: a small lambda icon at far right
- Selectable

---

## Graph View

In graph view, API Gateway resources appear as regular nodes without container/child relationships.

**Node types registered in `nodeTypes` map:**
- `'apigw'` → `ApigwNode` (reuse same component, graph variant renders without expand/collapse)
- `'apigw-route'` → `ApigwRouteNode`

**Edges derived in `deriveEdges()`:**

```ts
// For each apigw-route node with lambdaArn:
if (node.type === 'apigw-route' && node.metadata.lambdaArn) {
  const lambdaNode = nodes.find(n => n.id === node.metadata.lambdaArn || n.label === extractFnName(node.metadata.lambdaArn as string))
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

// For each apigw-route node: connect to parent apigw node
edges.push({
  id:     `apigw-route-${node.id}`,
  source: node.metadata.apiId as string,
  target: node.id,
  type:   'step',
  style:  { stroke: 'var(--cb-border)', strokeWidth: 1 },
})
```

Lambda node lookup: first try matching `n.id === lambdaArn`, then try `n.metadata.arn === lambdaArn`.

---

## CRUD — CLI via existing `cli:run` path

All write operations go through the existing `buildCommand.ts` / `buildDeleteCommands.ts` / `buildEditCommands.ts` pipeline. No new IPC channels or SDK write handlers are needed.

### Create API

```bash
aws apigatewayv2 create-api \
  --name <name> \
  --protocol-type HTTP \
  --cors-configuration AllowOrigins=<origins>,AllowMethods='*',AllowHeaders='*'
```

`buildCommand.ts` case for `'apigw'`:
- If `corsOrigins.length > 0`: include `--cors-configuration` with `AllowOrigins` as comma-joined list
- If `corsOrigins` empty: omit `--cors-configuration`

### Edit API

```bash
aws apigatewayv2 update-api \
  --api-id <id> \
  --name <name> \
  --cors-configuration AllowOrigins=<origins>,AllowMethods='*',AllowHeaders='*'
```

`buildEditCommands.ts` case for `'apigw'`.

### Delete API

```bash
aws apigatewayv2 delete-api --api-id <id>
```

`buildDeleteCommands.ts` case for `'apigw'`. Deleting an API also deletes all its routes (API Gateway cascades). Inspector shows a warning: "Deletes all routes in this API."

### Create Route

```bash
aws apigatewayv2 create-route \
  --api-id <apiId> \
  --route-key "<METHOD> <path>"
```

`buildCommand.ts` case for `'apigw-route'`. The form provides `parentId` (the API ID).

### Delete Route

```bash
aws apigatewayv2 delete-route \
  --api-id <apiId> \
  --route-id <routeId>
```

`buildDeleteCommands.ts` case for `'apigw-route'`. `apiId` and `routeId` come from `node.metadata`.

---

## Inspector Changes

**`apigw` node selected:**
- Standard fields: ID, NAME, REGION, STATE
- Metadata display:
  - `ENDPOINT` — full endpoint URL (with copy button)
  - `PROTOCOL` — HTTP
  - `CORS ORIGINS` — comma-joined list or `(none)` if empty
  - `ROUTES` — count of child route nodes
- Buttons: Edit, Delete
- Delete shows confirmation warning: "This will delete all routes inside the API."

**`apigw-route` node selected:**
- Standard fields: ID (composite `${apiId}/routes/${routeId}`), LABEL (`METHOD PATH`), REGION
- Metadata display:
  - `METHOD`
  - `PATH`
  - `API` — parent API name (look up by `metadata.apiId` in node list)
  - `TARGET` — if `lambdaArn` set: `arn:aws:lambda:...` with copy button; otherwise `(no integration)`
- Buttons: Delete only (no edit — delete and recreate)
- No edit button shown

---

## Forms

All form components follow the existing pattern in `src/renderer/components/modals/`.

### `ApigwForm` (create API)

Fields:
- **Name** (text input, required) — API name
- **CORS Origins** (multi-row add/remove) — each row is a text input for one origin (e.g. `https://example.com`). Add row button. Remove button per row. Empty rows ignored on submit.

On submit, produces `ApigwParams`:
```ts
export interface ApigwParams {
  resource: 'apigw'
  name: string
  corsOrigins: string[]
}
```

### `ApigwEditForm` (edit API)

Fields:
- **Name** (text, pre-filled from current `node.label`)
- **CORS Origins** (same multi-row add/remove, pre-filled from `node.metadata.corsOrigins`)

On submit, produces `ApigwEditParams`:
```ts
export interface ApigwEditParams {
  resource: 'apigw'
  apiId: string
  name: string
  corsOrigins: string[]
}
```

### `ApigwRouteForm` (create route)

Fields:
- **Method** (select): `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `ANY` — default `GET`
- **Path** (text, required) — must start with `/`; validated client-side

The form receives `parentId` (API ID) from the selected node context when "Add Route" is triggered from an API node's Inspector or context menu.

On submit, produces `ApigwRouteParams`:
```ts
export interface ApigwRouteParams {
  resource: 'apigw-route'
  apiId: string      // parentId from context
  method: string
  path: string
}
```

**Route creation context:** In `CreateModal.tsx`, when the selected node is an `apigw` node and the user clicks "Add Route", the modal passes `selectedNode.id` as `parentId` to `ApigwRouteForm`.

---

## Type Definitions Summary

### `src/renderer/types/create.ts` additions

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

// Extend CreateParams union:
export type CreateParams = ... | ApigwParams | ApigwRouteParams
```

### `src/renderer/types/edit.ts` additions

```ts
export interface ApigwEditParams {
  resource: 'apigw'
  apiId: string
  name: string
  corsOrigins: string[]
}

// Extend EditParams union:
export type EditParams = ... | ApigwEditParams
```

---

## Context Menu

In `CanvasContextMenu.tsx`, when right-clicking on an `apigw` node, add a menu item:
- "Add Route" — opens `CreateModal` with resource pre-set to `'apigw-route'` and `parentId` set to the node ID

When right-clicking the canvas background (no node), add:
- "New API Gateway" — opens `CreateModal` with resource pre-set to `'apigw'`

---

## New Files

| File | Purpose |
|------|---------|
| `src/main/aws/services/apigw.ts` | Scan functions for API GW v2 (`listApis`, `listRoutes`) |
| `src/renderer/components/canvas/nodes/ApigwNode.tsx` | Container node (API) |
| `src/renderer/components/canvas/nodes/ApigwRouteNode.tsx` | Route child node |
| `src/renderer/components/modals/ApigwForm.tsx` | Create API form |
| `src/renderer/components/modals/ApigwEditForm.tsx` | Edit API form |
| `src/renderer/components/modals/ApigwRouteForm.tsx` | Create route form |

## Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `@aws-sdk/client-apigatewayv2` |
| `src/main/aws/client.ts` | Add `ApiGatewayV2Client` to `AwsClients` + `createClients` |
| `src/main/aws/scanner.ts` | Add `listApis` + `listRoutes` calls |
| `src/renderer/types/cloud.ts` | Add `'apigw'`, `'apigw-route'` to `NodeType` |
| `src/renderer/types/create.ts` | Add `ApigwParams`, `ApigwRouteParams`, extend `CreateParams` |
| `src/renderer/types/edit.ts` | Add `ApigwEditParams`, extend `EditParams` |
| `src/renderer/utils/buildCommand.ts` | Add `apigw`, `apigw-route` cases |
| `src/renderer/utils/buildDeleteCommands.ts` | Add `apigw`, `apigw-route` cases |
| `src/renderer/utils/buildEditCommands.ts` | Add `apigw` case |
| `src/renderer/components/canvas/TopologyView.tsx` | Render `ApigwNode` containers in VPC row, draw route→lambda edges |
| `src/renderer/components/canvas/GraphView.tsx` | Register node types, add route→lambda + route→apigw edges |
| `src/renderer/components/Inspector.tsx` | Handle `apigw`, `apigw-route` node types |
| `src/renderer/components/modals/CreateModal.tsx` | Wire `ApigwForm`, `ApigwRouteForm`; pass `parentId` for routes |
| `src/renderer/components/modals/EditModal.tsx` | Wire `ApigwEditForm` |
| `src/renderer/components/canvas/CanvasContextMenu.tsx` | Add "New API Gateway" + "Add Route" menu items |

---

## Scope

**In scope:**
- API Gateway v2 HTTP APIs: scan, create, edit, delete
- Routes: scan, create, delete
- Lambda integration edges (topology + graph)
- ApigwNode container with ApigwRouteNode children in topology
- CORS origins management in create/edit forms
- Inspector for both `apigw` and `apigw-route`

**Out of scope:**
- REST APIs (v1)
- WebSocket APIs
- Custom domains
- Authorizers
- VPC Links
- Stage management (uses `$default` auto-deploy only)
- Route editing (delete and recreate)
- Integration creation via GUI (integrations exist only through CLI / IaC)
