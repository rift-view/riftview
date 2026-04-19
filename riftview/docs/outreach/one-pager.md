# RiftView — One-Pager

## Hero

**See what breaks when something breaks.**

RiftView is an incident diagnostic tool for AWS. Click any resource, see
every service upstream and downstream, with remediation hints inline.

## The problem

At 3am, when something breaks in AWS, the first 20 minutes go to:

1. Which services depend on the broken one?
2. What's the upstream trigger chain?
3. Which Lambda talks to that queue, and what else reads from it?
4. If I roll this back, what else breaks?

The AWS Console answers none of those questions. Diagrams drift from
reality. Tribal memory is slow and error-prone.

## The solution

**Scan → click → blast radius.**

RiftView runs a read-only AWS scan (your credentials, your machine) and
renders your infrastructure as a live connected graph. Click any node
and you see:

- **Every service upstream** — what could break it
- **Every service downstream** — what it will take with it
- **Hop distance rings** — how many edges away each service sits
- **Edge type per connection** — triggers, subscriptions, origins
- **Remediation hints** — pre-built CLI commands for known fixes

Copy the radius to Slack as a Markdown list in one click. Re-root by
clicking a different node.

## Differentiation

- **vs. Cloudcraft:** Live, not manually maintained. Diagrams never drift.
- **vs. Firefly:** Pre-flight check before their recovery automation runs.
- **vs. Datadog:** Structure-first. Metrics overlay onto the graph.
- **vs. Console:** One window, one graph, one keyboard workflow.

## Under the hood

- Electron desktop app (macOS; Windows/Linux in Q3)
- AWS SDK v3 reads in a sandboxed main process; aws CLI subprocess for
  writes. Credentials **never** cross the renderer boundary.
- 24 resource types scanned in parallel, sub-second delta updates
- Drift detection against Terraform baselines
- Advisory rules gated on real scan metadata (no LLM guesses)
- LocalStack support for offline demos

## Pilot

- 30-day free pilot for your team
- No credit card, no SSO integration required
- Install: download the .dmg, open, connect your AWS profile
- Feedback loop direct with the founder

## Contact

**Julius Hamm** · jhaxe23@gmail.com · github.com/rift-view/riftview

---

*Built on the observation that most AWS incidents are structural, not
numerical. If you can see the structure, you can diagnose faster.*
