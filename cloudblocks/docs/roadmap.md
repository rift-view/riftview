# Cloudblocks Product Roadmap

**Last updated:** 2026-03-26
**Status:** Active — sequenced into waves, each wave independently shippable and revertable.

---

## Guiding Principles

- Every feature ships as isolated, independently revertable commits
- No wave starts until the previous wave's bugs are resolved
- Each item gets its own spec → plan → implementation cycle
- Foreman owns sequencing decisions; user approves direction at wave boundaries

---

## Tier 1 — Immediate Bugs

Fix before any new features. All XS–M effort, all isolated.

| ID | Item | Detail | Effort |
|----|------|--------|--------|
| B1 | **Region zone containment** | `RegionZoneNode` boxes are visual overlays only (`zIndex: -2`). Nodes have no `parentId` to their region zone — don't move with the box, don't resize it. VPC/subnet/globalZone all use `parentId` + `extent: 'parent'`; region zones need the same treatment. | M |
| B2 | **`driftFilterActive` not reset** | `clearImportedNodes` doesn't reset `driftFilterActive` in `useUIStore`. One-liner fix — filter stays `true` after clearing import, corrupting the next import session. | XS |
| B3 | **Test housekeeping** | (a) `compareDrift.test.ts` tests 8+9 are duplicate assertions. (b) `useIpc.test.ts` mock may be missing multi-region methods (`selectRegion`, `startScan` with regions arg). Audit and fix. | XS |
| B4 | **`SCAN_KEY_TO_TYPE` contract test** | 22-key map in `Sidebar.tsx` has no structural link to `provider.ts`. One test imports both and asserts no asymmetry. Prevents silent badge drift when services are added. | XS |

---

## Tier 2 — Core Product Completeness

Makes existing shipped surfaces feel finished. Each item is independently shippable.

| ID | Item | Detail | Effort |
|----|------|--------|--------|
| C1 | **Edit forms for M5.5 services** | SQS, SNS, DynamoDB, Secrets Manager, ECR, SFN, EventBridge, and ACM all have Create+Delete but no Edit. Ships as one sprint, one form per commit. Key fields: SQS (visibility timeout, retention), DynamoDB (billing mode, capacity), Secrets (description, rotation), ECR (scan-on-push, mutability), SFN (definition, role), EventBridge (description), SNS (display name, delivery policy), ACM (no editable fields — remove edit affordance). | L |
| C2 | **Empty canvas onboarding** | First-time user opens app with blank canvas and no guidance. Renderer-only: show a welcome state when no profile is configured or no scan has run yet — "Connect your AWS profile to start scanning" with a Settings CTA. No backend changes. | S |

---

## Tier 3 — Depth Features

Expands what users can actually do with the canvas.

| ID | Item | Detail | Effort |
|----|------|--------|--------|
| D1 | **Canvas annotations** | `loadAnnotations`/`saveAnnotations` IPC already exists (unused). Free-floating sticky notes and per-node notes on the canvas. Zero backend work. | S |
| D2 | **IAM analysis panel** | `analyzeIam(nodeId, nodeType, metadata)` IPC exists but is not surfaced. Add an Inspector panel section showing effective permissions for the selected resource. Frontend-only integration. | M |
| D3 | **R53 + SSM CRUD** | Route 53 zones and SSM parameters are scan-only. R53: create/delete hosted zones + A/CNAME records. SSM: create/update/delete parameters. One service at a time — R53 first (higher user demand). | M per service |
| D4 | **Full VPC build-from-scratch** | Subnet and IGW are scan-only. User can create a VPC from the canvas but can't add subnets or attach an IGW without leaving the UI. Completing this closes the full VPC provisioning loop. | M |
| D5 | **Multi-select + bulk ops** | Every action is currently single-node. Multi-select → bulk delete, bulk HCL export. Required for managing infrastructure at scale. | L |

---

## Tier 4 — Platform / Architecture

| ID | Item | Detail | Effort |
|----|------|--------|--------|
| P1 | **Filter composition model** | Sidebar filter, scan error badges, and region zones are three independent visibility systems. A fourth (e.g., "show only drifted nodes") will break without a unified filter model. Design before shipping the next filter type. | M (design-first) |
| P2 | **Background scan + drift notifications** | Scan is currently user-triggered or timer-based with no notification on change. Tray notification or in-app alert when a scan detects drift. Makes Cloudblocks feel like active monitoring. | M |
| P3 | **M6 multi-cloud plugin architecture** | Azure, GCP, Vercel. `CloudProvider` interface already designed for this. Core question: how do plugins register NodeTypes, scan handlers, and CRUD commands without forking the codebase? Design-first sprint. | L–XL |

---

## Wave Sequencing

| Wave | Items | Gate |
|------|-------|------|
| **Wave 1** | B1, B2, B3, B4, C2 | — |
| **Wave 2** | C1 (all 8 edit forms, one sprint) | Wave 1 complete |
| **Wave 3** | D1, D2, D3 | Wave 2 complete |
| **Wave 4** | D4, D5, P1 (design) | Wave 3 complete |
| **Wave 5** | P2, P3 | Wave 4 complete |

---

## Rollback Strategy

Each item ships as isolated commits on its own branch. Revert path for each wave:

- **Wave 1 bugs**: Each fix is a single commit, `git revert <sha>` cleanly undoes it
- **C1 edit forms**: One commit per service form — revert any individual service without touching others
- **D1 annotations**: Feature-flagged by whether `loadAnnotations` returns data; removing the component is a single-file revert
- **D5 multi-select**: Additive to existing node interaction model — revert removes the selection layer without breaking single-node ops
- **P3 plugin architecture**: Designed as a new interface layer over existing `awsProvider` — reverting restores the direct provider, no existing functionality breaks
