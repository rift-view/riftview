# RiftView Marketing Website — Design Spec

**Date:** 2026-04-19
**Status:** Draft for user review
**Owner:** Product (Julius)
**Repo target:** `github.com/rift-view/riftview-website` (public)

---

## Goal

Ship a static marketing site for RiftView in time for the Week-1 soft launch described in `riftview/docs/outreach/distribution-plan.md`. The site is the landing target for r/devops, Platform Engineering Slack, YC Bookface, and the HN Show post.

## Non-goals (v1)

- CMS or blog (add later if needed)
- Signup form with backend (mailto link is enough for pilot)
- Analytics (drop in Plausible/GA later, not blocking launch)
- Serverless, edge functions, or SSR — deploy target is static S3+CloudFront
- Docs site / in-depth product docs — README on the app repo covers that for v1

## Hosting + domain

- User hosts on AWS (S3 + CloudFront assumed). Site MUST build to pure static `dist/` with no runtime dependencies.
- Domain: `riftview.io` (probable, not purchased yet). Canonical URL configurable in one place so swap is trivial.
- No host-specific CI (user owns deploy pipeline). GitHub Actions does build verification only.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Astro 5 | Static output, 0 JS by default, file-based routing, fast |
| Styling | Tailwind CSS 4 | Matches app stack, design token reuse |
| Type-checking | TypeScript (strict) | Matches app conventions |
| Package manager | npm | Matches app repo |
| Node version | 20.x (LTS) | Same as app |
| Linting | ESLint + Prettier | Light config, same rules where possible |
| License | MIT | Matches `riftview` |

Rejected: Next.js (SSR/RSC overkill for one-pager), plain HTML (no component reuse, harder to evolve), 11ty (smaller ecosystem than Astro for Tailwind 4).

## Pages

| Route | Purpose | Content source |
|---|---|---|
| `/` | Landing one-pager | `riftview/docs/outreach/one-pager.md` + `riftview/docs/POSITIONING.md` |
| `/pricing` | Pilot + tiers | `riftview/docs/outreach/pricing.md` |
| `/privacy` | Privacy policy | V1 boilerplate authored during scaffold: read-only AWS scans, no credentials leave the user's machine, no telemetry in v1, mailto contact for data requests |
| `/terms` | Terms of service | V1 boilerplate authored during scaffold: 30-day pilot terms from `pricing.md`, "no warranty", MIT-licensed OSS client, standard choice of law |
| `/404` | Astro default styled to match | — |

## Landing page structure

Order matches the user's attention budget (hero → proof → detail → CTA):

1. **Hero** — "See what breaks when something breaks" + subhead from positioning, demo clip placeholder (20s mp4 poster, plays on click), primary CTA "Download" and secondary "See how it works" (jumps to Features).
2. **Problem** — the 3am-pages narrative (4 numbered questions from `one-pager.md`).
3. **Solution / Features** — 4-card grid: Blast radius, Live cross-service graph, Top risks, Drift detection. Each card: one-line headline, one sentence, a minimal icon or inline SVG. Guided remediation gets a 5th card or gets merged into Blast radius — call made during build.
4. **Differentiation** — 4 short comparison blocks (vs Cloudcraft, vs Firefly, vs Datadog, vs Console) from `POSITIONING.md`.
5. **Under the hood** — trust section: Electron, read-only scans, credentials never cross renderer boundary, 24 resource types, LocalStack support. Security is a differentiator; lead with it.
6. **Pilot CTA** — 30-day free pilot, no credit card, mailto link to founder.
7. **Footer** — GitHub link, contact, legal links (Privacy, Terms), `Not affiliated with AWS` disclaimer from app README.

## Visual direction

- **Dark-first.** Match the app's terminal/CRT aesthetic. Light mode not required for v1 (add later if demanded).
- **Palette:** one primary accent (the app's status-active green), neutral dark grays for surfaces, single warning amber for advisory references. CSS variables so a `--accent` swap is a 1-line change.
- **Typography:** sans-serif for body (Inter or system), mono for code/technical labels (JetBrains Mono or system mono). No more than two families.
- **Motion:** one subtle hero animation (CSS-only blast-radius pulse on a mock node graph). No autoplay video. No scroll-hijack.
- **Imagery:** screenshots of the app from `riftview/docs/ui-preview.html` where possible; demo clip once recorded.

## Repository layout

```
riftview-website/
  .github/workflows/ci.yml        ← lint + build on push/PR
  .gitignore
  LICENSE                         ← MIT
  README.md                       ← dev + deploy instructions (incl. s3 sync snippet)
  astro.config.mjs
  package.json, package-lock.json
  tsconfig.json
  public/
    favicon.svg
    og.png                        ← 1200x630 placeholder
    demo-blast-radius.mp4         ← placeholder, swap when recorded
    demo-blast-radius.gif         ← placeholder
  src/
    layouts/
      Base.astro                  ← <head>, meta, OG, analytics slot
    pages/
      index.astro
      pricing.astro
      privacy.astro
      terms.astro
      404.astro
    components/
      Hero.astro
      Problem.astro
      Features.astro
      Differentiation.astro
      UnderTheHood.astro
      Pilot.astro
      Footer.astro
      Nav.astro
      FeatureCard.astro           ← reusable card primitive
    styles/
      global.css                  ← Tailwind directives + CSS vars
    content/
      site.ts                     ← centralized strings (canonical URL, contact email, CTA copy)
```

Rationale for `src/content/site.ts`: domain swap, email rotation, and CTA tweaks shouldn't require touching component markup.

## CI

`.github/workflows/ci.yml` runs on push to main and on PRs:

1. `npm ci`
2. `npm run lint` (ESLint)
3. `npm run typecheck` (astro check)
4. `npm run build` (astro build → dist/)

No deploy step. User will handle `aws s3 sync dist/ s3://…` + CloudFront invalidation manually or via their own pipeline. README documents the exact commands.

## Deploy (user's responsibility, documented in README)

```bash
# One-time: create bucket, OAC, CloudFront distribution, Route 53 alias.
# Ongoing:
npm run build
aws s3 sync dist/ s3://riftview-io-site/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths '/*'
```

Not automating this because: user owns the AWS account, wants control over rollout, and it's a good meta-demo of the thing RiftView visualizes.

## Accessibility + SEO baseline

- Semantic HTML (nav, main, section, footer)
- All interactive elements keyboard-reachable
- Color contrast AA minimum (accent green on dark must pass)
- One `h1` per page, descending heading order
- `<meta name="description">`, OG tags, Twitter card per page via `Base.astro`
- `sitemap.xml` via `@astrojs/sitemap`
- `robots.txt` allowing all

## Performance budget

- First Contentful Paint < 1.2s on 3G throttled
- Total JS shipped < 20 KB gzipped (Astro + Tailwind purged)
- Demo clip lazy-loaded, poster image only above the fold
- No web fonts blocking render (font-display: swap)

## Content sourcing

All copy already exists in the `riftview` app repo:

- Hero + sections → `riftview/docs/outreach/one-pager.md`
- Differentiation → `riftview/docs/POSITIONING.md`
- Pricing → `riftview/docs/outreach/pricing.md`
- Legal disclaimer → `riftview/README.md` (Legal section)

These are BizDev-sign-off pending but production-adjacent. Copy goes in verbatim where possible; any tightening done during component authoring gets noted in the PR description.

## Open questions

1. **Demo clip availability.** Is the `demo-blast-radius.mp4` recorded yet, or do we ship with a static screenshot for the hero placeholder and swap post-record? (Assumption: placeholder for v1.)
2. **Contact email on site.** One-pager uses `jhaxe23@gmail.com`. Use the same, or set up `hello@riftview.io` first? (Assumption: use Julius's personal email, easy to rotate via `site.ts` later.)
3. **Legal pages.** Boilerplate OK for v1, or hold until a lawyer reviews? (Assumption: ship light boilerplate with a visible "v1 draft" note.)

## Acceptance criteria

- `npm run build` produces a `dist/` that passes `npx serve dist` local smoke test.
- Lighthouse (mobile, throttled): Performance ≥ 95, Accessibility ≥ 95, SEO ≥ 95.
- All links resolve, no 404s from the landing page.
- CI green on `main` in `rift-view/riftview-website`.
- Content on `/` matches the current `one-pager.md` verbatim for hero + problem + pilot sections.

## Out of scope (tracked for later)

- Blog / changelog
- Customer logos / testimonials (need real customers first)
- Interactive demo sandbox
- Docs site
- Analytics
- A/B testing infrastructure
- i18n

---

*Source material: `riftview/docs/outreach/{one-pager,pricing,distribution-plan}.md`, `riftview/docs/POSITIONING.md`, `riftview/README.md`.*
