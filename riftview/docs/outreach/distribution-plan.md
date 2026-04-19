# Demo Clip Distribution Plan

**Goal:** Get the 20-second blast radius demo in front of 1,000+ AWS
practitioners in the first two weeks post-launch.

## The asset

- **Format:** .mp4, 20 seconds, 1920x1080, H.264
- **Content:** Scan → click → blast radius → copy-to-Slack → done
- **Account:** LocalStack-seeded (not real account, for privacy)
- **Overlay:** Minimal caption text in the first 3 seconds
- **Variants:** Full (20s), teaser (6s, no caption), GIF (≤3MB)
- **Location:** `docs/assets/demo-blast-radius.{mp4,gif}` (post-record)

See `docs/superpowers/plans/2026-04-13-demo-clip-spec.md` for the
shot-by-shot storyboard.

## Distribution channels

### Week 1 — Soft launch

| Channel | Format | CTA |
|---|---|---|
| r/devops | GIF in post + text explainer + GitHub link | "Beta tester feedback welcome" |
| r/aws | GIF + post about the blast radius concept | Same |
| Platform Engineering Slack (#show-and-tell) | MP4 + short pitch | "DM if you want the dmg" |
| YC Bookface (Show channel) | MP4 + full one-pager | "Free pilot for YC companies" |

### Week 2 — Targeted amplification

| Channel | Format | CTA |
|---|---|---|
| Hacker News Show HN | Blog post with embedded GIF + link | Main GitHub repo |
| Twitter/X — own handle | MP4 thread, 3 tweets | Retweet ask from founder network |
| LinkedIn — own profile | MP4 post + founder commentary | Book a demo |
| Indie Hackers | Post-mortem style post ("I built X because Y") | Direct link |

### Week 3+ — Owned content

- **Blog post**: "Why we built an incident diagnostic layer for AWS"
- **YouTube**: 5-minute product walkthrough (full demo, not the clip)
- **Podcast outreach**: DevOps / Platform Engineering podcasts — cold
  pitch the founder story

## What success looks like

| Metric | Week 1 | Week 2 | Week 4 |
|---|---|---|---|
| Clip views (aggregated) | 2,000 | 8,000 | 20,000 |
| Website visits | 500 | 2,000 | 5,000 |
| Pilot signups | 10 | 30 | 75 |
| Booked demos | 5 | 15 | 40 |
| Press / podcast mentions | 0 | 1 | 3 |

Conversion funnel assumption: 20% view → visit, 5% visit → pilot,
50% pilot → booked demo. These are aspirational; actual numbers will
differ by channel.

## Channel-specific framing

### r/devops

Lead with the pain, not the product. Open with "Here's a thing I built
to answer the question I kept asking in incidents." Show the GIF above
the fold. Don't oversell. Reddit will smell the pitch and downvote.

### Hacker News

File under `Show HN`. Title: `Show HN: RiftView – See what breaks when
something breaks (AWS blast radius tool)`. Front-load the technical
details in the first comment. HN rewards technical depth, punishes
marketing language.

### LinkedIn

Write in first person as founder. Open with a specific incident story
(real or composite) where blast radius would have helped. Embed the
video. CTA at the end — soft, link to one-pager, not pilot signup.

### YC Bookface

Play the long game. Don't push pilot signups. Instead, ask for
feedback on the positioning doc. YC founders are over-pitched; they
respond to genuine input requests.

### Twitter/X

3-tweet thread:
1. **Hook:** "Every AWS incident starts with the same question: which
   services does this take down with it?" + clip
2. **Detail:** "RiftView answers that in one click. Upstream,
   downstream, hop distance, edge type, remediation inline."
3. **CTA:** "Free pilot, read-only, credentials stay local. Link in bio."

## Response plan

### High-interest replies
- Respond within 4 hours during launch week
- Default to offering a 15-min live demo (real or LocalStack account)
- Track which channel the reply came from for conversion attribution

### Negative / skeptical replies
- Engage once with genuine technical response
- Don't argue. Don't oversell.
- If they come around, re-engage. If not, disengage.

### Silence
- Don't repost the same clip on the same channel for 10+ days
- Follow up with a **different** asset (screenshot, blog post, etc.)
  after the first clip fatigues

## Risks

- **Launch clip flops.** Mitigation: record 3 variants in one session,
  A/B test in Week 1, amplify whichever lands.
- **Hacker News rejection.** Mitigation: soft-launch to r/devops
  first, use any positive signal as social proof in HN post.
- **Twitter/LinkedIn algorithm suppression.** Mitigation: LinkedIn
  video is separate algorithm from text posts; try both.
- **Users install but don't come back.** Mitigation: in-app onboarding
  (C1 ghost hint) points at blast radius immediately. First scan = aha.

## Post-distribution review

After Week 4:
- Which channel converted highest?
- Which variant of the clip got shared most?
- What objections came up most often?
- What feature requests emerged?

Update this plan for v2 launch (likely tied to Windows/Linux builds).

---

*Last updated 2026-04-17.*
