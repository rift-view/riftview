# Cloudblocks M3 — Design Spec
**Date:** 2026-03-12
**Status:** Approved

## Overview

M3 completes the CRUD core: delete and modify operations for all seven resource types (VPC, EC2, SG, RDS, S3, Lambda, ALB), three deferred create forms (RDS, Lambda, ALB), a persistent settings panel, EC2 key pair scanning, and M2 technical debt cleanup.

Every write operation — create, edit, delete, stop, start — routes through the CLI Engine and Command Drawer. Nothing mutates without explicit user confirmation.

---

## Interaction Model

### Node context menu (right-click on a node)

Right-clicking a canvas **node** shows a node actions menu — distinct from right-clicking empty canvas (which still opens the create menu). React Flow's `onNodeContextMenu` prop handles the distinction.

Node context menu items:
- **Edit [resource type]** — opens pre-filled Edit modal
- **Delete [resource type]** — opens delete confirmation dialog
- **Stop / Start** — EC2 and RDS only; routes directly to Command Drawer

**Reboot is Inspector-only** — it does not appear in the right-click context menu. Context menu keeps the action list short; Reboot is a less-common operation surfaced only in the Inspector's quick action buttons.

### Inspector panel

The Inspector gains three areas for nodes that support them:

1. **Quick action buttons** (EC2, RDS): Stop / Start / Reboot — go straight to Command Drawer, no modal
2. **Edit button** → opens pre-filled Edit modal
3. **Delete button** → opens delete confirmation dialog (same as right-click delete)

---

## Delete Flow

Right-click node → "Delete [type]" → type-to-confirm dialog → CLI Engine → rescan on success.

**Type-to-confirm dialog:** user must type the resource ID/name before the Delete button enables. Pre-condition warnings appear above the input field:
- VPC with active subnets or instances: "VPC has attached resources. Detach them first."
- Non-empty S3 bucket: warning + "Force delete (removes all objects)" toggle — adds `--force` to `aws s3 rb`
- RDS without final snapshot: "Skip final snapshot?" toggle

**Settings preference:** users can switch to Command Drawer confirmation mode in Settings — delete command appears in the drawer as a preview, user clicks Run.

### Delete commands

| Resource | Command |
|---|---|
| VPC | `aws ec2 delete-vpc --vpc-id <id>` |
| EC2 | `aws ec2 terminate-instances --instance-ids <id>` |
| SG | `aws ec2 delete-security-group --group-id <id>` |
| RDS | `aws rds delete-db-instance --db-instance-identifier <id> [--skip-final-snapshot]` |
| S3 | `aws s3 rb s3://<bucket> [--force]` |
| Lambda | `aws lambda delete-function --function-name <name>` |
| ALB | `aws elbv2 delete-load-balancer --load-balancer-arn <arn>` |

---

## Edit / Modify Flow

Edit modal reuses the M2 Create modal component with a new `mode: 'edit'` prop. It pre-fills fields from the resource's `metadata` in the Zustand store. Save generates CLI commands through the same CLI Engine / Command Drawer path.

### Editable fields and commands per resource

**VPC**
- Name tag
- `aws ec2 create-tags --resources <id> --tags Key=Name,Value=<name>`

**EC2**
- Name tag, instance type (requires stop if running), security groups
- Instance type change on a running instance: stop → modify → start (3-command chain via CLI Engine). All three commands are queued as a sequence and displayed together in the Command Drawer before the user clicks Run. CLI Engine executes them in order after confirmation. If the instance is already stopped, the stop command is omitted and only modify → start are queued.
- `aws ec2 create-tags` + `aws ec2 modify-instance-attribute`

**SG**
- Inbound rules (add/remove rows) — name and description are immutable in AWS
- `aws ec2 authorize-security-group-ingress` / `aws ec2 revoke-security-group-ingress` per changed rule

**SG rule diffing:** `CloudNode.metadata.rules` stores the current rule set as `Array<{ protocol: string; fromPort: number; toPort: number; cidr: string }>`. M3 updates the SG service scanner to populate this field in exactly this shape from `IpPermissions` in the `DescribeSecurityGroups` response. A rule's identity is the tuple `(protocol, fromPort, toPort, cidr)`. On save, compute the diff: rules present in the new set but absent from the old → authorize; rules present in the old set but absent from the new → revoke. AWS has no in-place rule edit — a modified rule is a revoke + authorize pair. All revoke commands are emitted before authorize commands.

**RDS**
- Instance class, multi-AZ toggle, deletion protection toggle
- `aws rds modify-db-instance --db-instance-identifier <id> --apply-immediately`

**S3**
- Versioning toggle, public access block toggles
- `aws s3api put-bucket-versioning` + `aws s3api put-public-access-block`

**Lambda**
- Memory (MB), timeout (s), environment variables (key-value pairs, addable/removable rows)
- `aws lambda update-function-configuration --function-name <name>`

**ALB**
- Name tag
- `aws elbv2 add-tags --resource-arns <arn> --tags Key=Name,Value=<name>`

### Quick action buttons (Inspector, EC2 and RDS only)

| Button | Command |
|---|---|
| EC2 Stop | `aws ec2 stop-instances --instance-ids <id>` |
| EC2 Start | `aws ec2 start-instances --instance-ids <id>` |
| EC2 Reboot | `aws ec2 reboot-instances --instance-ids <id>` |
| RDS Stop | `aws rds stop-db-instance --db-instance-identifier <id>` |
| RDS Start | `aws rds start-db-instance --db-instance-identifier <id>` |
| RDS Reboot | `aws rds reboot-db-instance --db-instance-identifier <id>` |

Quick actions skip the Edit modal — they go straight to the Command Drawer (preview + Run / Cancel). Successful execution triggers a rescan.

Edit modal saves also trigger a rescan on success.

---

## New Create Forms (deferred from M2)

### RDS

| Field | Notes |
|---|---|
| DB instance identifier | Name |
| Engine | Dropdown: MySQL, PostgreSQL, MariaDB |
| Instance class | Dropdown: db.t3.micro, db.t3.small, db.m5.large |
| Master username | Text |
| Master password | Password input |
| VPC | Dropdown from store |
| Publicly accessible | Toggle, default off |
| Multi-AZ | Toggle, default off |
| Allocated storage (GB) | Number, default 20 |

Generates: `aws rds create-db-instance ...`

### Lambda

| Field | Notes |
|---|---|
| Function name | Text |
| Runtime | Dropdown: nodejs20.x, python3.12, java21, go1.x |
| Handler | Text, e.g. `index.handler` |
| Role ARN | Free text (dropdown in M4 once IAM roles are scanned) |
| Memory (MB) | Number, default 128 |
| Timeout (s) | Number, default 3 |
| VPC | Optional dropdown from store; when selected, shows two additional fields |
| Subnets | Multi-select filtered by VPC (visible only when VPC is selected) |
| Security groups | Multi-select from store (visible only when VPC is selected) |

When VPC is set, the command includes `--vpc-config SubnetIds=<subnets>,SecurityGroupIds=<sgs>`.

Generates: `aws lambda create-function ...`

### ALB

| Field | Notes |
|---|---|
| Name | Text |
| Scheme | Dropdown: internet-facing / internal |
| VPC | Dropdown from store |
| Subnets | Multi-select filtered by VPC |
| Security groups | Multi-select from store |

Generates: `aws elbv2 create-load-balancer ...`

---

## Settings Panel

Accessible via a gear icon in the TitleBar. Renders as a full-panel overlay.

Persisted to `<app.getPath('userData')>/settings.json` (resolves to `~/Library/Application Support/cloudblocks/settings.json` on macOS) via new IPC channels (`settings:get` / `settings:set`). Two new entries will be added inside the `IPC` const object in `src/main/ipc/channels.ts`: `SETTINGS_GET: 'settings:get'` and `SETTINGS_SET: 'settings:set'`. Adding them inside `IPC` ensures they are included in the `IpcChannel` union type that is derived from that const. Main process reads/writes the file; renderer never touches the filesystem directly.

The Zustand store gains a `settings` object (deleteConfirmStyle: `'type-to-confirm' | 'command-drawer'`, scanInterval: `15 | 30 | 60 | 'manual'`) with `loadSettings` and `saveSettings` actions that go through IPC.

The existing `commandPreview: string` store field is widened to `commandPreview: string[]` to support multi-command sequences (e.g., EC2 stop→modify→start). The `setCommandPreview` action signature widens from `(cmd: string)` to `(cmd: string[])`. The Command Drawer renders each command on its own line. Before landing this change, run a codebase-wide search for all `commandPreview` read-sites and update every consumer: callers that set it wrap their string in an array; callers that read it (e.g., `CommandDrawer.tsx`) must handle `string[]`.

### M3 settings

| Setting | Options | Default |
|---|---|---|
| Delete confirmation style | Type to confirm / Command Drawer | Type to confirm |
| Scan interval | 15s / 30s / 60s / Manual only | `30` (number) |

**Foundation for M4:** Settings panel includes a placeholder "Theme" category in M3 (greyed out) so the panel structure is in place before M4 theme logic arrives.

---

## EC2 Key Pair Scanning

New `describeKeyPairs` call added to the EC2 service scanner. Key pairs are stored separately in the Zustand store as a new top-level field `keyPairs: string[]` — not as `CloudNode` objects since they are not canvas resources. The store gains a `setKeyPairs` action.

`Ec2Form` (create) and the EC2 Edit modal replace the free-text key pair field with a dropdown populated from `keyPairs`.

---

## M2 Technical Debt

- **IPC listener teardown:** replace `ipcRenderer.removeAllListeners` in `src/preload/index.ts` with `ipcRenderer.removeListener` + stable callback refs. Fixes the multi-subscriber bug flagged in M2 code review.
- **Required field validation:** highlight empty required fields with a red border on Run attempt; block submission until satisfied. Applied to all Create and Edit forms.

---

## NodeType — no changes needed

`NodeType` in `src/renderer/types/cloud.ts` already includes `'rds'` | `'lambda'` | `'alb'` | `'security-group'` from M1. No changes required. Throughout this spec "SG" is shorthand for the `'security-group'` node type. Context menus and modal titles use the full label: "Edit Security Group", "Delete Security Group".

---

## Out of Scope

- IAM role scanning or management (M4)
- Drag-and-drop creation (M2-polish, not yet scheduled)
- CloudWatch metrics or alarms
- VPC subnet / internet gateway create/delete
- RDS subnet group management
- Multi-region operations in a single session
