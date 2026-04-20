# RiftView + Firefly.ai — Coexistence Framing

## One-line pitch for Firefly users

> RiftView is what you look at **before** you approve Firefly's plan.

## What Firefly does

Firefly runs agentic recovery automation. When something breaks, their
Codification, SRE, and DR agents propose and execute corrective actions.
Their strength is _automating the response_ — taking action at machine
speed when a human would take minutes or hours.

## What RiftView does

RiftView is the **visual diagnostic layer**. Click a broken resource,
see the full blast radius, understand what will change before anyone
pulls a trigger. Our strength is _seeing structure_ — making dependency
relationships obvious at a glance.

## Why they're complementary, not competitive

| Concern                   | Firefly answers        | RiftView answers                    |
| ------------------------- | ---------------------- | ----------------------------------- |
| What should be automated? | Everything safe        | —                                   |
| How do we recover?        | Auto-run remediation   | —                                   |
| What is about to change?  | —                      | Every upstream / downstream service |
| What did this depend on?  | —                      | Full dependency graph               |
| Is the plan safe?         | Agent confidence score | Visual blast radius                 |
| What's the audit trail?   | Agent action log       | Live structural snapshot            |

## How they combine in a workflow

1. **Incident fires.** CloudWatch, PagerDuty, or human notices.
2. **RiftView diagnoses.** Engineer clicks the failing resource, sees
   the blast radius: 6 upstream services, 12 downstream, max 3 hops.
3. **Plan is drafted.** Either the engineer writes it, or Firefly
   proposes one.
4. **RiftView previews.** The blast radius view shows what the plan will
   touch. The engineer validates scope.
5. **Firefly executes.** The human approves; Firefly runs the plan.
6. **RiftView verifies.** Post-execution, the graph reflects the new
   structure. Any unexpected change is immediately visible.

## Objection handling

### "Doesn't Firefly already visualize infrastructure?"

Firefly surfaces a resource catalog and action history. It does not
visualize the **causal graph** — which service depends on which, in
which direction, with which edge type. RiftView's core value is that
graph being first-class.

### "Why would I add a second tool?"

You don't have to. If Firefly's automation covers your incident surface
cleanly, RiftView is optional. The overlap is small enough that you can
pilot RiftView for diagnostic value without displacing Firefly.

### "We already use Datadog / New Relic for this."

APM tools anchor on metrics. They'll tell you _that_ p99 spiked on a
Lambda. They won't show you the 12 downstream services that read from
the queue that Lambda writes to. RiftView anchors on structure first,
metrics second.

## Messaging by channel

- **Cold email to Firefly users:** "If you're already using Firefly for
  recovery, RiftView is the pre-flight check. 15-minute demo?"
- **Platform eng community:** "We visualize what Firefly automates.
  Different lane, same underlying problem."
- **Investor framing:** "Complementary to agentic infra tools — we're
  the human-in-the-loop layer that keeps those agents safe."

---

_Last reviewed 2026-04-17._
