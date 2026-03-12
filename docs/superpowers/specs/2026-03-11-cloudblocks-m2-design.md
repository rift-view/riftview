# Cloudblocks M2 — Design Spec
**Date:** 2026-03-11
**Status:** Approved

## Overview

M2 adds resource creation to the read-only M1 viewer. Users can create VPCs, EC2 instances, Security Groups, and S3 buckets via a GUI form. Every write operation generates a real `aws` CLI command shown to the user before execution. Nothing mutates without explicit approval.

## Interaction Flow

1. User right-clicks the canvas → context menu with view mode (Topology / Graph) and resource types (New VPC, New EC2, New Security Group, New S3 Bucket)
2. Picking a resource + view mode opens the creation modal
3. As the user fills the form, the Command Drawer live-updates with the generated CLI command
4. User clicks **Run** in the drawer
5. Modal stays open. Drawer expands with streaming stdout/stderr from the `aws` subprocess
6. A ghost node (`status: "creating"`) appears on canvas immediately
7. **On success:** modal closes, immediate rescan triggered, scanner replaces ghost with real node
8. **On failure:** stderr shown in red, modal stays open for correction, ghost removed

Drag-and-drop from palette is scaffolded but not wired (deferred).

## Resource Forms

All dropdowns for VPC/Subnet/SG are populated from the live Zustand store — no extra API calls.

### VPC
| Field | Default |
|---|---|
| Name | — |
| CIDR block | `10.0.0.0/16` |
| Tenancy | default |

Generates: `aws ec2 create-vpc --cidr-block <cidr> --instance-tenancy <tenancy> --tag-specifications ...`

### EC2 Instance
| Field | Notes |
|---|---|
| Name | tag |
| AMI ID | — |
| Instance type | dropdown, default `t3.micro` |
| Key pair | dropdown from `aws ec2 describe-key-pairs` |
| VPC | dropdown from existing nodes |
| Subnet | filtered by selected VPC |
| Security Groups | multi-select from existing nodes |

Generates: `aws ec2 run-instances ...`

### Security Group
| Field | Notes |
|---|---|
| Name | — |
| Description | — |
| VPC | dropdown from existing nodes |
| Inbound rules | repeating rows: protocol, port range, source CIDR |

Generates: `aws ec2 create-security-group ...` + one `aws ec2 authorize-security-group-ingress ...` per rule, run sequentially.

### S3 Bucket
| Field | Default |
|---|---|
| Bucket name | — |
| Region | pre-filled from current session |
| Block all public access | on |

Generates: `aws s3api create-bucket --bucket <name>` (+ `--create-bucket-configuration` if non-us-east-1) + `aws s3api put-public-access-block ...`

## CLI Engine

New `CliEngine` in `src/main/cli/`:

- `buildCommand(resource, params)` — returns `argv[]`. Pure function, unit-testable.
- `execute(argv[], win)` — spawns `aws` CLI, streams output line-by-line via IPC, resolves on exit
- Multi-command resources run sequentially; chain stops on first non-zero exit

New IPC channels:

| Channel | Direction | Purpose |
|---|---|---|
| `cli:run` | renderer → main | send argv, start execution |
| `cli:output` | main → renderer | stream `{ line, stream }` |
| `cli:done` | main → renderer | `{ code }` on exit |
| `cli:cancel` | renderer → main | kill in-flight process |

## State

Two additions to the Zustand store:

- `pendingNodes` — ghost nodes in "creating" state (pulsing amber status dot)
- `cliOutput` — current command's log lines, cleared on each new run

## Command Drawer

- Thin strip at rest showing the live-generated command with **Run** and **Cancel** buttons
- On Run: expands upward showing streaming log (stdout white, stderr amber/red)
- On success: shows "✓ Success", collapse button
- On failure: stays expanded showing error

## Out of Scope

- Modify / delete operations (M3)
- Drag-and-drop creation (scaffolded only)
- Form validation beyond required fields
- RDS, ALB, Lambda creation (M3)
- Playwright E2E tests (deferred)
