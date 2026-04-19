# Cloudblocks — Design Spec
**Date:** 2026-03-10
**Status:** Approved

## Overview

Cloudblocks is a desktop application that provides a visual GUI for building, managing, and visualizing cloud infrastructure on AWS (with Azure, GCP, and Vercel planned). It is not a cloud service — it is a developer tool that wraps existing cloud CLIs and SDKs, making infrastructure work accessible to junior, senior, and principal architects alike.

The core mechanic: read operations use the AWS SDK directly for speed and reliability; write operations generate and execute real `aws` CLI commands, which are shown to the user for review before execution.

## Delivery Format

**Electron desktop app** (macOS/Windows/Linux). Chosen for:
- Direct subprocess access to the `aws` CLI
- Filesystem access to `~/.aws/credentials` and `~/.aws/config`
- No browser sandbox constraints
- Mature ecosystem for developer tooling (VS Code, Figma, Slack precedent)

Future: VS Code extension as a companion or alternative delivery.

## Canvas Interaction Model

**Hybrid — two views on the same infrastructure, toggled from the left sidebar:**

- **Topology Map (default):** Resources nested inside their actual AWS hierarchy — Region → VPC → Subnet → Resource. Mirrors real AWS structure. Best for understanding containment and architecture at a glance.
- **Graph View:** Free-form node graph where resources are nodes and relationships are edges. VPC is a hub node; connections radiate outward. Edge routing uses strict 90° orthogonal "pipes" (React Flow `step` edge type). Best for understanding cross-service relationships.

Both views are live. Selecting a node in one view keeps it selected when toggling to the other.

> **Future:** Pipe routing style flagged for a dedicated polish pass in a later milestone.

## Command Execution Model

**Smart split:**
- **Read/describe operations** (list, describe, status) execute automatically via AWS SDK — no confirmation needed.
- **Write/destructive operations** (create, modify, delete) generate the exact `aws` CLI command string and display it in the Command Drawer for user review. The user clicks **Run** to execute. Nothing mutates without explicit approval.

## Architecture

### Process Split

```
┌─────────────────────────────────┐     IPC      ┌─────────────────────────────────┐
│   RENDERER PROCESS (React UI)   │ ◄──────────► │   MAIN PROCESS (Node.js)        │
│                                 │              │                                  │
│  • Hybrid Canvas (React Flow)   │              │  • AWS Service Layer             │
│  • Resource Palette             │              │    - AWS SDK v3 (reads)          │
│  • Inspector Panel              │              │    - CLI subprocess (writes)     │
│  • Command Drawer               │              │  • Resource Scanner              │
│  • Zustand Store                │              │  • CLI Engine                    │
│                                 │              │  • Credential Manager            │
└─────────────────────────────────┘              └─────────────────────────────────┘
```

All renderer↔main communication goes through Electron's `ipcMain`/`ipcRenderer` with a typed channel contract. Credentials never leave the main process.

### UI Layout

Four zones:

| Zone | Content |
|---|---|
| **Title bar** | App name, AWS profile selector, region selector, connection status indicator |
| **Left sidebar** | Resource palette (AWS service catalog), view toggle (Topology / Graph) |
| **Main canvas** | Hybrid React Flow canvas with toolbar (Scan, Fit, Zoom, Auto-layout, Filter) and minimap |
| **Right sidebar** | Inspector panel — selected resource details, config, action buttons |
| **Command drawer** | Persistent bottom strip — generated CLI command, Run/Cancel buttons, streaming output log |

### Resource Data Model

Every AWS resource in the graph is a typed `CloudNode`:

```ts
interface CloudNode {
  id: string           // ARN
  type: string         // "ec2" | "vpc" | "rds" | "alb" | "lambda" | "s3" ...
  label: string        // human name or resource ID
  status: "running" | "stopped" | "pending" | "error" | "unknown"
  region: string
  metadata: Record<string, unknown>  // raw SDK response
  parentId?: string    // VPC, Subnet containment for topology view
}
```

Edges are **derived**, not stored — the scanner infers relationships from SDK response fields (e.g. EC2's `VpcId`, RDS's `DBSubnetGroup`).

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 32+ |
| UI framework | React 18 + TypeScript |
| Canvas | React Flow |
| State management | Zustand |
| AWS reads | AWS SDK v3 (JS) |
| CLI execution | Node `child_process` |
| Styling | Tailwind CSS |
| Build tooling | Electron Forge + Vite |

## Credential & Auth Flow

- Credentials sourced exclusively from `~/.aws/credentials` and `~/.aws/config` — Cloudblocks does not store or manage credentials.
- On startup, main process reads available profiles and populates the title bar profile selector.
- Selecting a profile + region instantiates a new SDK client and triggers a full scan.
- Profile or region switch: tears down current client, re-instantiates, triggers fresh scan.
- No credentials found: onboarding screen with `aws configure` instructions.
- Credentials stay in the main process only — never sent to the renderer via IPC.

## Polling & Live Status (M1)

- Resource Scanner polls on a configurable interval (default: 30s).
- Each cycle: describe calls via SDK → diff against current Zustand graph → push delta (added/changed/removed nodes) via IPC.
- Status dots on nodes reflect live resource state: green (running/active), amber (pending/degraded), red (stopped/error).
- Manual **Scan** button triggers an immediate out-of-cycle refresh.
- No websockets or CloudWatch events in M1 — polling is sufficient for POC.

## Error Handling

| Category | Behavior |
|---|---|
| Credential errors | Top-of-canvas banner with AWS error message and suggested fix |
| Scan errors | Affected nodes show red status dot + error tooltip; rest of canvas stays functional |
| CLI execution errors | Command drawer expands, shows full stderr in red; canvas state unchanged until success |

No silent failures — every error surfaces somewhere visible.

## Testing Strategy

| Layer | Approach |
|---|---|
| AWS Service Layer | Unit tests with mocked SDK clients (no real AWS calls) |
| CLI Engine | Unit tests asserting correct command string generation |
| Resource Scanner | Unit tests on diff logic with fixture data |
| React components | React Testing Library |
| IPC contract | Integration tests with mock main process |
| E2E | Manual for M1; Playwright + Electron deferred to M2 |

## Milestones

| # | Name | Scope |
|---|---|---|
| **M1** | POC — Read-only viewer | Connect to AWS, scan resources, render hybrid canvas, live status dots, credential flow, 30s polling |
| **M2** | Build basics | Create VPC, EC2, Security Group, S3 Bucket via GUI; smart-split CLI execution; command drawer with streaming output |
| **M3** | Full CRUD core | Modify + delete for VPC, EC2, SG, RDS, S3, ALB, Lambda |
| **M4** | Theme system | VS Code-style theme plugins; light/modern theme alongside retro dark default |
| **M5** | Multi-cloud | Plugin architecture for Azure, GCP, Vercel providers |

## Out of Scope

- Cloudblocks is not a cloud service and does not host any infrastructure.
- No custom credential storage — delegates entirely to `aws configure`.
- No Terraform/CDK integration in M1–M3.
- No team collaboration features in M1–M3.
