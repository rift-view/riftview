# RiftView — Positioning

**One-liner (cold-email / hero):**

> See what breaks when something breaks. Click a node, see every service
> upstream and downstream, with remediation hints inline.

## Category framing

**RiftView is an incident diagnostic tool for AWS.**

Not a diagram tool. Not an architecture visualizer. Not a replacement for
the Console. A tool you open **when something is wrong** and you need to
understand the blast radius before you pull a trigger.

## Target user (buyer persona v1)

- **Role:** DevOps / Platform lead at a Series A–B startup (30–100 eng)
- **Stack:** AWS-native, Terraform-managed, 50–400 resources per account
- **Pain:** 3am pages where "which services does this touch?" takes 20
  minutes of hopping between Console tabs + Slack-questions to seniors
- **Alternative they use today:** AWS Console + CloudMap + tribal memory

## The "aha moment"

First scan. Click any node. **The graph dims to just the services that
break with it.** Upstream colored one way, downstream another, direction
badge per node. Copy-to-Slack formats the radius as a list. Hit Escape,
the viewport restores.

That is the 15-second pitch. Everything else — advisories, drift, guided
remediation, SSM terminal pane, Terraform export — is compounding value.

## Differentiation

### vs. Cloudcraft (Architecture-as-diagram)
Cloudcraft diagrams drift from reality. RiftView is live — it's a **view
of the account**, not an artifact edited by humans. Cloudcraft answers
"what did we build?"; RiftView answers "what is broken *right now*?"

### vs. Firefly.ai (Agentic recovery automation)
Firefly automates recovery. RiftView is the **pre-flight check**: you
understand what's about to change before an agent runs. **Complementary,
not competitive.** A pitch to Firefly users: *"RiftView is what you look
at before you approve Firefly's plan."*

### vs. Datadog Service Catalog / New Relic CMP
Observability-first tools anchor on metrics. RiftView anchors on
**structure** — the graph itself is the primary artifact, and metrics
overlay onto it. A Datadog dashboard tells you "p99 is up"; RiftView
tells you "p99 is up on *this* Lambda and here are the 6 services that
will degrade when it does."

### vs. AWS Console
Console is a browser-per-service. RiftView is one window where the
graph is the navigation. Click a Lambda → see its SQS upstream → click
that → see which Lambdas consume it → Escape → back to where you were.

## Proof points

- 1022 tests across main/renderer/preload
- Live scanner for 24 resource types including SNS→SQS ARN-level edges
- Drift detection against Terraform baseline with diff table
- Guided remediation with pre-built CLI commands (executable from the
  Inspector with no copy-paste)
- Advisory rules with severity (critical/warning/info) gated on real
  scan metadata, not LLM guesses
- LocalStack integration for offline demos

## Non-goals (for v1)

- Multi-cloud (M6 planned post-outreach)
- Cost optimization surfaces (different buying motion)
- Automation / self-healing (Firefly's lane)
- Collaborative editing (one user, one account, one canvas)

## Outreach sequencing

See also `docs/outreach/` (drafts pending BizDev sign-off):

1. Landing one-pager with 20s demo clip
2. Cold email variants — DevOps lead, platform eng, YC founders
3. r/devops / Platform Engineering Slack demo post
4. Peer intros via YC Bookface
