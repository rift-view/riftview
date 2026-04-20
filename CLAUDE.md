---
  # CLAUDE.md

  ## Project: RiftView

  Visual desktop app for AWS infrastructure management. Source lives in `riftview/`. All commands run from `riftview/` unless noted.

  **Stack:** Electron 32 + electron-vite · React 19 · TypeScript · Zustand 5 · Tailwind CSS 4 · React Flow v12 (@xyflow/react) · AWS SDK v3 · Vitest + RTL · GitHub Actions CI

  ---

  ## External docs

  Planning notes, specs, team docs, and agent personas live in a separate private repo at `~/riftview-docs/` (remote: `rift-view/riftview-docs`). Read directly when context is needed — same filesystem, no checkout required. Do not commit references or paths to it in the public repo.

  ---

  ## Repo Layout

  Monorepo layout (npm workspaces) — apps for runtime surfaces, packages for shared logic.

  proj1/
    .github/workflows/ci.yml           ← CI (lint, typecheck, test on push/PR)
    riftview/
      apps/
        desktop/                       ← Electron app (main + renderer + preload)
          src/
            main/                      ← Electron main process
              aws/
                client.ts              ← AwsClients factory (createClients)
                services/              ← per-service read helpers (used by awsPlugin)
              ipc/
                channels.ts            ← IPC channel constants
                handlers.ts            ← ipcMain.handle registrations
              plugin/
                types.ts               ← RiftViewPlugin interface (replaces the old CloudProvider)
                registry.ts            ← PluginRegistry (scanAll, fan-out with partial-failure isolation)
                awsPlugin.ts           ← AWS plugin (scan wiring, CRUD command builders, HCL generators)
                index.ts               ← plugin registration
              terraform/
                provider.ts            ← LocalStack HCL provider-string builder (NOT CloudProvider)
              cli/                     ← CLI subprocess runner (aws CLI execution)
            preload/
              index.ts                 ← contextBridge exposure
              index.d.ts               ← Window.riftview type declarations
            renderer/
              src/App.tsx              ← root component, IPC bootstrap
              store/                   ← useCloudStore / useUIStore / useCliStore (split stores)
              components/
                canvas/                ← TopologyView, GraphView, CloudCanvas, nodes/
                modals/                ← CreateModal, EditModal, DeleteDialog
                Inspector.tsx · Sidebar.tsx · CommandDrawer.tsx · CanvasToast.tsx
              utils/                   ← buildCommand / buildDeleteCommands / buildEditCommands /
                                        applyTheme / pricing.ts / etc.
              assets/pricing.json      ← bundled per-NodeType pricing (used by cost preview)
          tests/                       ← integration-style tests (outside src/)
      apps/cli/                        ← riftview CLI (scan / risks / drift / diff / version)
      packages/
        shared/                        ← cross-app logic (depends on neither Electron nor DOM)
          src/
            types/
              cloud.ts                 ← NodeType (all 32 values), CloudNode, IntegrationEdgeData,
                                        ScanDelta, Settings, Theme — THE source of truth
            analysis/                  ← analyzeNode, advisory rules, sortAdvisories
            aws/                       ← scanner, computeDelta, shared AWS client helpers
            drift/                     ← drift detection logic
            graph/                     ← blast-radius BFS, integration-edge derivation
            scan/                      ← scanOnce, cross-service orchestration
          tests/                       ← unit tests for shared package
      docs/superpowers/                ← **gitignored** in the public repo
        specs/                         ← design specs (lives in the private riftview-docs repo)
        plans/                         ← implementation plans (same)

  ---

  ## Architecture Rules

  ### Execution model (read vs write)
  - **Reads:** AWS SDK v3 in main process, routed through `PluginRegistry.scanAll()` in `apps/desktop/src/main/plugin/registry.ts`
  - **Writes:** `aws` CLI subprocess via `cli:run` IPC — never SDK writes
  - Credentials stay in main process, never cross to renderer
  - Known open concern: `IPC.CLI_RUN` currently accepts arbitrary argv from the renderer; a follow-up ticket will allowlist-narrow it (surfaced by the 2026-04-20 Snapshot Export threat-model pass)

  ### IPC boundary
  - `apps/desktop/src/preload/index.d.ts` is the contract — every method on `window.riftview` must be declared here
  - Add new IPC channels to `channels.ts` first, then `handlers.ts`, then `preload/index.ts`, then `preload/index.d.ts`

  ### Adding a new AWS service (scan)
  1. Create/extend the scan helper under `apps/desktop/src/main/aws/services/` (flat-service or paginated pattern)
  2. Add client to `AwsClients` interface + `createClients()` in `apps/desktop/src/main/aws/client.ts`
  3. Wire into `awsPlugin.scan()` in `apps/desktop/src/main/plugin/awsPlugin.ts` — add to the `Promise.all([...])` array with `.catch(catch_('service-name'))`
  4. Add `NodeType` entry to `packages/shared/src/types/cloud.ts` — that union is the source of truth (renderer and CLI both import from here)
  5. Add entry to every `Record<NodeType, string>` map in the renderer (`ResourceNode.tsx`, `SearchPalette.tsx`, and any new ones)

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

  Any `Record<NodeType, string>` map **must** include all 32 values (31 real types + `unknown`). When adding a new NodeType, update:
  - `packages/shared/src/types/cloud.ts` (the union — single source of truth)
  - `apps/desktop/src/renderer/components/canvas/nodes/ResourceNode.tsx` (TYPE_BORDER, TYPE_LABEL)
  - `apps/desktop/src/renderer/components/canvas/nodes/SearchPalette.tsx` (TYPE_BADGE_COLOR, TYPE_SHORT)
  - `apps/desktop/src/renderer/assets/pricing.json` (a row for the new type, even if zero)
  - Any advisory rule keyed on the specific NodeType under `packages/shared/src/analysis/`

  ---

  ## CI Requirements

  All three must pass on every PR:
  npm run lint        # ESLint
  npm run typecheck   # tsc --noEmit (per-workspace configs + root project refs)
  npm test            # Vitest (apps/desktop + packages/shared + apps/cli)

  - `JSX.Element` return types are **not allowed** — use `React.JSX.Element` (JSX namespace isn't globally available in this tsconfig)
  - `Record<NodeType, string>` maps must be exhaustive or typecheck fails

  ---

  ## Key Patterns

  **Optimistic UI:** `addOptimisticNode` / `removeOptimisticNode` on `useCloudStore`. Add before CLI run, remove on success/failure.

  **Toast feedback:** `useUIStore.getState().showToast('message', 'success' | 'error')` — clears itself after 2.5s.

  **Drag-to-create:** Sidebar items are `draggable`. Canvas `onDrop` calls `setActiveCreate({ resource, view, dropPosition })` → `CreateModal` opens.

  **Search-to-fly:** `⌘K` → `SearchPalette` → `App.tsx:handleSearchSelect` → `window.dispatchEvent(new CustomEvent('riftview:fitnode', { detail: { nodeId } }))` → `CloudCanvas` fits view to node.

  **Saved views (slots 1–4):** `useUIStore.saveView(slot, name, view)` snapshots current `nodePositions`. `loadView` restores positions + calls `fitViewFn`.

  **Local mode detection:** `profile.endpoint` being set means local emulator (LocalStack). Use `const isLocal = !!profile.endpoint` in forms to auto-fill placeholder values (e.g. EC2 AMI defaults to `ami-12345678`). CLI subprocess injects `AWS_ACCESS_KEY_ID: 'test'`, `AWS_SECRET_ACCESS_KEY: 'test'`, and clears `AWS_PROFILE` when endpoint is set — real credentials must never be used for local calls.

  **Terraform HCL export:** HCL generators live on the plugin (`awsPlugin.hclGenerators` per the `RiftViewPlugin` interface). Export triggered via `ipc:terraform-export` → native file-save dialog. Each generator is a pure function `(node: CloudNode) => string`. New NodeTypes need a generator entry or typecheck fails (`Record<NodeType, TerraformGenerator>`).

  **Snapshot Export (expanded 2026-04-20):** No longer a static HTML export — now a versioned local time-machine with safe, cost-aware restore. Live in the Linear project "Snapshot Export" (RIF-5, RIF-18, RIF-19, RIF-20, RIF-21). Specs in `docs/superpowers/specs/2026-04-20-snapshot-export-*.md` (in the private docs repo). RIF-20 (threat model) is an Urgent blocker on RIF-18 / RIF-19 / RIF-21; nothing apply-side merges without SecOps sign-off.

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
  | Phase 0 | ✅ Done | Product rename to window.riftview (all 25 renderer files); feature flag system (VITE_FLAG_* + flag() util); Ladle component dev environment (port 61000, standalone vite config) |
  | Phase 1 | ✅ Done | STATUS_LANGUAGE (error pulse, pending shimmer, stopped dim, deleting fade-pulse); ACTION_RAIL (Copy ARN + Open Console hover strip); COMMAND_BOARD (swim-lane view, 7-tier NODE_TIER, TierLabelNode, integration edges); all three now always-on |
  | Phase 2 | ✅ Done | EXECUTION_ENGINE: guided remediation in Inspector (REMEDIATE section, buildRemediateCommands, drift diff table); now always-on |
  | Phase 3 | ✅ Done | OP_INTELLIGENCE: `analyzeNode()` pure fn, advisory system (critical/warning/info), scan metadata additions (multiAZ, publicAccessEnabled, hasPublicSsh); always-on |
  | Phase 4 | ✅ Done | Advisory surface: ResourceNode advisory badges, 5 new rules (sqs-no-dlq, rds-no-backup, rds-no-deletion-protection, s3-no-versioning, lambda-no-dlq), Inspector Fix button + buildAdvisoryRemediations |
  | Remediation Loop | ✅ Done | `patchNodeStatus` store action, optimistic pending, toast feedback, auto-rescan after successful remediate |
  | Op Intelligence | ✅ Done | CloudWatch metrics overlay on Lambda/RDS/ECS, per-node change history in Inspector, SSM terminal pane with xterm.js, keyboard-first navigation (j/k/Enter/r/?/1-4) |
  | Blast Radius Polish | ✅ Done | Bidirectional BFS traversal, hop-distance rings, direction badges (● ↑ ↓ ↕), non-members opacity 0 + pointerEvents none, fitView on enter, savedViewport restore on exit, Inspector BLAST RADIUS section with grouped member list, copy-as-Markdown, click-to-re-root |
  | Outreach Readiness | 🚧 In-progress | Positioning doc, IPC boundary doc, code signing/notarization, redact-account-IDs demo mode, landing one-pager, cold email templates |
  | M6 | Planned | Hetzner plugin — validates the multi-cloud interface beyond AWS (~1 wk) |
  | M6.1 | Planned | Vercel plugin — projects/deployments/domains; second interface-shape check (~1 wk) |
  | M6.5 | Planned | Azure + GCP plugins — heavy SDK-driven providers (~6–8 wk combined) |

  ---
