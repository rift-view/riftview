# Pricing Model — v1 Draft

**Status:** Draft for BizDev review. Not published externally.

## Pilot tier (v1 launch)

**Free** for 30 days. No credit card. No SSO integration. No forced
upgrade.

### What pilot users get

- Full feature access (scan, blast radius, drift, advisories, remediation)
- Single machine, single account
- Direct email support from founder
- Access to private Slack for beta feedback

### What we get

- Real-world usage signal on 20–50 accounts
- Validated willingness-to-pay via post-pilot conversion
- Testimonials and case studies for public launch

## Post-pilot tiers (directional)

These are drafts; price points will be validated against pilot feedback
before public pricing.

### Individual — `$19/mo`

- 1 user, unlimited AWS accounts
- All diagnostic features
- Email support
- Target: solo founders, consultants, individual platform engineers

### Team — `$49/user/mo` (min 3 seats)

- Shared saved views across teammates
- Team-wide advisory rule customization
- Slack integration for blast radius sharing
- Priority support
- Target: 3–30 person engineering teams

### Enterprise — Contact

- SSO / SAML
- SOC 2 Type II compliance documentation
- Advanced deployment (air-gapped, on-prem option)
- SLA with response-time guarantees
- Volume licensing
- Target: 50+ person orgs, regulated industries

## Pricing principles

1. **No freemium.** Pilot is 30 days then pay. Freemium attracts wrong
   users and dilutes feedback.
2. **No per-resource pricing.** We don't want users to game the scan
   to save money. Per-user aligns incentives.
3. **No infrastructure tax.** We're not billing based on your AWS spend.
4. **Transparent pricing page from day one** — no "contact us" unless
   the customer is genuinely enterprise-only.

## Competitive anchoring

- **Datadog:** $15+/host. Different pricing axis (per resource, not
  per user). Customers already paying Datadog should not see RiftView
  as a budget competitor.
- **Cloudcraft:** $49/user/mo (team). Our pricing intentionally
  matches theirs on team tier — we're explicit upgrade path when
  their diagrams drift.
- **Brainboard:** $25/user/mo. Our Individual tier undercuts slightly
  on single-user given smaller feature scope of theirs.
- **Firefly:** Enterprise-only, opaque. Our public pricing is a
  deliberate differentiator against their contact-sales model.

## Discounting policy

- **Annual prepay:** 15% discount
- **YC / early-stage startups:** 50% off for 12 months (ask in cold email)
- **Open-source maintainers:** Free Individual tier (lifetime)
- **Students:** Free Individual tier (with .edu email)

No negotiated discounts beyond the above in v1. Complexity kills
small-team sales motion.

## Revenue model projections (directional, not forecast)

| Pilot → paid conversion | Users paying | MRR (Team @ $49/user avg) |
|---|---|---|
| 20% | 20 users × 3 avg seats = 60 | $2,940 |
| 30% | 60 × 3 = 180 | $8,820 |
| 40% | 100 × 3 = 300 | $14,700 |

Assumes 300 pilot signups in first 6 months. Conservative.

## Open questions for BizDev

- Should we offer a **one-time purchase** tier for users who don't
  want subscription? (Users may prefer $249 once vs. $19/mo.)
- What's the **cancellation recovery** motion? If someone churns,
  do we email at month 3 with a re-engagement offer?
- Does the **team tier minimum (3 seats)** make sense, or should it
  be 1+ with flat team-feature pricing?

---

*Last updated 2026-04-17 (Julius draft, pre-BizDev review).*
