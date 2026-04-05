---
  # CLAUDE.md

  ## Project: Terminus

  Visual desktop app for AWS infrastructure management. Source lives in `cloudblocks/`. All commands run from `cloudblocks/` unless noted.

  **Stack:** Electron 32 + electron-vite · React 19 · TypeScript · Zustand 5 · Tailwind CSS 4 · React Flow v12 (@xyflow/react) · AWS SDK v3 · Vitest + RTL · GitHub Actions CI

  ---

  ## Repo Layout

  proj1/
    .github/workflows/ci.yml   ← CI (lint, typecheck, test on push/PR)
    cloudblocks/               ← all source
      src/
        main/                  ← Electron main process
          aws/
            client.ts          ← AwsClients factory (createClients)
            provider.ts        ← CloudProvider interface + awsProvider (scan wiring)
            scanner.ts         ← ResourceScanner (computeDelta, key-pair scan)
            services/          ← one file per AWS service (read-only scans)
          ipc/
            channels.ts        ← IPC channel constants
            handlers.ts        ← ipcMain.handle registrations
        preload/
          index.ts             ← contextBridge exposure
          index.d.ts           ← Window.cloudblocks type declarations
        renderer/
          src/App.tsx          ← root component, IPC bootstrap
          store/
            cloud.ts           ← useCloudStore (nodes, scan status, settings)
            ui.ts              ← useUIStore (view, selection, toast, nodePositions, savedViews)
            cli.ts             ← useCliStore (CLI output, pending commands)
          types/
            cloud.ts           ← NodeType, CloudNode, ScanDelta, Settings, Theme
            create.ts          ← CreateParams per resource
            edit.ts            ← EditParams per resource
          components/
            canvas/
              TopologyView.tsx ← structured layout (VPC containers, global zone)
              GraphView.tsx    ← free-floating graph
              CloudCanvas.tsx  ← view switcher + fitNode event listener
              nodes/           ← ResourceNode, VpcNode, SubnetNode, GlobalZoneNode,
                               ←   AcmNode, CloudFrontNode, ApigwNode, ApigwRouteNode
            modals/            ← CreateModal, EditModal, DeleteDialog + per-service forms
            Inspector.tsx      ← right-panel metadata + quick actions
            Sidebar.tsx        ← service list with count badges + drag-to-create
            CommandDrawer.tsx  ← CLI preview + execution
            CanvasToast.tsx    ← in-canvas post-action feedback
          utils/
            buildCommand.ts       ← CreateParams → aws CLI argv[][]
            buildDeleteCommands.ts← CloudNode → delete argv[][]
            buildEditCommands.ts  ← EditParams → aws CLI argv[][]
            applyTheme.ts         ← sets data-theme on document.documentElement
      tests/                   ← integration-style tests (outside src/)
      docs/superpowers/
        specs/                 ← design specs per milestone
        plans/                 ← implementation plans per milestone

  ---

  ## Architecture Rules

  ### Execution model (read vs write)
  - **Reads:** AWS SDK v3 in main process, routed through `PluginRegistry.scanAll()` in `src/main/plugin/registry.ts`
  - **Writes:** `aws` CLI subprocess via `cli:run` IPC — never SDK writes
  - Credentials stay in main process, never cross to renderer

  ### IPC boundary
  - `src/preload/index.d.ts` is the contract — every method on `window.terminus` must be declared here
  - Add new IPC channels to `channels.ts` first, then `handlers.ts`, then `preload/index.ts`, then `preload/index.d.ts`

  ### Adding a new AWS service (scan)
  Follow the pattern in `src/main/aws/services/scanFlatService.ts`:
  1. Create `services/{name}.ts` using `scanFlatService` (or manual paginated loop for SSM-style)
  2. Add client to `AwsClients` interface + `createClients()` in `client.ts`
  3. Wire into `awsPlugin.scan()` in `src/main/plugin/awsPlugin.ts` — add to the `Promise.all([...])` array with `.catch(catch_('service-name'))`
  4. Add `NodeType` entry to `src/renderer/types/cloud.ts`
  5. Add entry to `Record<NodeType, string>` maps in `ResourceNode.tsx` and `SearchPalette.tsx`

  ### Canvas — controlled React Flow
  Both `TopologyView` and `GraphView` use React Flow in **controlled mode** (`nodes={flowNodes}`).
  - `livePositions` local state tracks in-flight drag positions (updated on every `dragging: true` change)
  - On drag-end: position persisted to `useUIStore.nodePositions`, `livePositions` cleared
  - `flowNodes` memo merges: livePositions → store positions → computed layout
  - **Never** remove `livePositions` from the `flowNodes` dependency array — nodes will snap back during drag

  ### State stores
  | Store | Owns |
  |-------|------|
  | `useCloudStore` | nodes, scan status, profile, region, settings, pendingNodes, keyPairs |
  | `useUIStore` | view, selectedNodeId, activeCreate, toast, nodePositions, savedViews, activeViewSlot |
  | `useCliStore` | cliOutput, commandPreview, pendingCommand |

  ---

  ## NodeType Completeness

  Any `Record<NodeType, string>` map **must** include all 24 values. When adding a new NodeType, update:
  - `src/renderer/types/cloud.ts` (the union)
  - `src/renderer/components/canvas/nodes/ResourceNode.tsx` (TYPE_BORDER, TYPE_LABEL)
  - `src/renderer/components/canvas/nodes/SearchPalette.tsx` (TYPE_BADGE_COLOR, TYPE_SHORT)

  ---

  ## CI Requirements

  All three must pass on every PR:
  npm run lint        # ESLint
  npm run typecheck   # tsc --noEmit (node + web configs)
  npm test            # Vitest (180 tests)

  - `JSX.Element` return types are **not allowed** — use `React.JSX.Element` (JSX namespace isn't globally available in this tsconfig)
  - `Record<NodeType, string>` maps must be exhaustive or typecheck fails

  ---

  ## Key Patterns

  **Optimistic UI:** `addOptimisticNode` / `removeOptimisticNode` on `useCloudStore`. Add before CLI run, remove on success/failure.

  **Toast feedback:** `useUIStore.getState().showToast('message', 'success' | 'error')` — clears itself after 2.5s.

  **Drag-to-create:** Sidebar items are `draggable`. Canvas `onDrop` calls `setActiveCreate({ resource, view, dropPosition })` → `CreateModal` opens.

  **Search-to-fly:** `⌘K` → `SearchPalette` → `App.tsx:handleSearchSelect` → `window.dispatchEvent(new CustomEvent('terminus:fitnode', { detail: { nodeId } }))` → `CloudCanvas` fits view to node.

  **Saved views (slots 1–4):** `useUIStore.saveView(slot, name, view)` snapshots current `nodePositions`. `loadView` restores positions + calls `fitViewFn`.

  **Local mode detection:** `profile.endpoint` being set means local emulator (LocalStack). Use `const isLocal = !!profile.endpoint` in forms to auto-fill placeholder values (e.g. EC2 AMI defaults to `ami-12345678`). CLI subprocess injects `AWS_ACCESS_KEY_ID: 'test'`, `AWS_SECRET_ACCESS_KEY: 'test'`, and clears `AWS_PROFILE` when endpoint is set — real credentials must never be used for local calls.

  **Terraform HCL export:** `utils/buildHclCommands.ts` maps `NodeType → HCL string`. Export triggered via `ipc:terraform-export` → native file-save dialog. Each generator is a pure function `(node: CloudNode) => string`. New NodeTypes need a generator entry or typecheck fails (`Record<NodeType, TerraformGenerator>`).

  **Integration edges:** Typed as `IntegrationEdgeData` — not derived from string-prefix matching. SQS nodes use queue ARN as their node ID to enable SNS→SQS edges. When adding a new service that integrates with others, add an `IntegrationEdgeData` entry, not a string prefix rule.

  **CRT power-on animation:** `crt-on` keyframe in `main.css`. Triggered in `CloudCanvas` via `crtKey` state (incremented on mount and profile change). Renders a full-overlay `<div>` that plays once and disappears. Do not remove `profileKey` from the effect dependency.

  ---

  ## Milestones

  | Milestone | Status | Summary |
  |-----------|--------|---------|
  | M1 | ✅ Done | Read-only viewer — scan + visualize live AWS |
  | M2 | ✅ Done | Create VPC/EC2/SG via GUI |
  | M3 | ✅ Done | Full CRUD core services; delete/edit; CLI drawer; settings |
  | M4 | ✅ Done | Theme system (dark/light/solarized/rose-pine/catppuccin) |
  | M5a | ✅ Done | ACM + CloudFront scan + CRUD |
  | M5b | ✅ Done | API Gateway HTTP v2 (scan + routes + CRUD) |
  | M5.5 | ✅ Done | 11 new services (SQS, Secrets, ECR, SNS, DynamoDB, SSM, NAT, R53, SFN, EventBridge, IGW); store split; CloudProvider interface; drag-to-create |
  | Canvas QoL | ✅ Done | Panning fixes; persistent node positions; saved view slots 1–4 |
  | LocalStack & Polish | ✅ Done | Local emulator support; static creds injection; generic endpoint routing; CRT animation; snap-to-grid; blueprint gridlines; collapsible SSM groups; Terraform HCL export (vpc/subnet/ec2/s3/lambda); integration edges (SNS→SQS via ARN node ID); EC2 form local hints |
  | Phase 0 | ✅ Done | Terminus rename (window.terminus, all 25 renderer files); feature flag system (VITE_FLAG_* + flag() util); Ladle component dev environment (port 61000, standalone vite config) |
  | Phase 1 | ✅ Done | STATUS_LANGUAGE (error pulse, pending shimmer, stopped dim, deleting fade-pulse); ACTION_RAIL (Copy ARN + Open Console hover strip); COMMAND_BOARD (swim-lane view, 7-tier NODE_TIER, TierLabelNode, integration edges); all three flag-gated off by default; 874 tests |
  | M6 | Planned | Multi-cloud plugin architecture (Azure, GCP, Vercel) |

  ---
