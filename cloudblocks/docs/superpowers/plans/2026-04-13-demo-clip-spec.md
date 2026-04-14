# Terminus Demo Clip — 20-Second Script
Date: 2026-04-13

## Goal
Convert a viewer into a GitHub star in 20 seconds.
Target: DevOps lead, platform engineer, startup CTO.

## Setup
- LocalStack running with localstack-seed.sh applied
- Terminus open, dark theme, Command Board view
- Window: 1280×800, no menu bar visible

## The Sequence

**0:00–0:03 — Scan fires**
Click "Scan". Progress indicator. Canvas populates with ~30 nodes
across tiers: Edge (APIGW), Compute (4 Lambdas), Data (RDS, DynamoDB),
Messaging (SNS, SQS), Config (Secrets).

**0:03–0:06 — Top Risks reveal**
Inspector panel fades in: "TOP RISKS"
Row 1 (🔴 CRITICAL): "Unguarded API→Lambda→RDS chain"
Row 2 (🔴 CRITICAL): "Unthrottled API with uncapped Lambda concurrency"  
Row 3 (🟡 WARNING): "SQS queue with no dead-letter queue"
Pause 1 second on this panel.

**0:06–0:11 — Blast radius**
Click the `ecommerce-api` APIGW node.
Canvas: everything unrelated dims to 20%.
Highlighted: APIGW → order-processor Lambda → orders-db RDS → order-queue SQS.
Amber strip: "BLAST RADIUS · ecommerce-api"
Hold 2 seconds.

**0:11–0:17 — Path trace**
Shift+click the `orders-db` RDS node.
Animation: nodes light up one by one, blue glow, 150ms stagger:
Internet → CloudFront → APIGW → Lambda → RDS.
Blue strip: "PATH · cloudfront → orders-db"
Hold 2 seconds.

**0:17–0:20 — End card**
Click to clear. Canvas returns to normal.
Cut to: Terminus wordmark on dark background.
Tagline: "The incident diagnostic layer AWS doesn't have."

## Recording Notes
- Use LocalStack seed data — consistent, repeatable
- Record at 2x then slow to 1x for the path trace animation
- No voiceover — music only (or silent)
- Export: MP4 + GIF (GIF for GitHub README embed)
- Caption overlay at 0:03: "Your top risks, ranked"
- Caption overlay at 0:06: "Click any node. See what breaks."  
- Caption overlay at 0:11: "Shift+click. Trace the path."
