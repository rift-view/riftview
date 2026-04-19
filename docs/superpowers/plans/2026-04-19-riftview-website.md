# RiftView Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a static marketing one-pager for RiftView at `github.com/rift-view/riftview-website`, deployable as static files to S3+CloudFront, with content sourced from existing outreach docs.

**Architecture:** Astro 5 + Tailwind CSS 4. Pure static output (`dist/`). File-based routing. Centralized site copy in `src/content/site.ts` for easy domain/email/CTA rotation. Build-only CI; deploy is manual via `aws s3 sync` (documented in README). Site lives in `/Users/burkii/riftview-website/`, separate from the app repo.

**Tech Stack:** Astro 5, Tailwind CSS 4, TypeScript (strict), npm, Node 20.x, ESLint, Prettier, MIT license.

**Spec:** `/Users/burkii/riftview/docs/superpowers/specs/2026-04-19-riftview-website-design.md`

---

## File structure

```
/Users/burkii/riftview-website/
  .github/workflows/ci.yml
  .gitignore
  .prettierrc.json
  LICENSE                              ← MIT, ©2026 Julius Hamm
  README.md                            ← dev + deploy instructions
  astro.config.mjs
  package.json, package-lock.json
  tsconfig.json
  public/
    favicon.svg
    og.png
    robots.txt
  src/
    content/
      site.ts                          ← canonical URL, contact email, CTAs, nav links
    layouts/
      Base.astro                       ← <head>, meta, OG, footer slot
    pages/
      index.astro                      ← landing one-pager
      pricing.astro
      privacy.astro
      terms.astro
      404.astro
    components/
      Nav.astro
      Hero.astro
      Problem.astro
      Features.astro
      FeatureCard.astro
      Differentiation.astro
      UnderTheHood.astro
      Pilot.astro
      Footer.astro
    styles/
      global.css                       ← Tailwind directives + CSS vars
```

---

## Task 1: Create the GitHub repo

**Files:** none locally yet (admin only).

- [ ] **Step 1: Create repo via gh CLI**

Run:
```bash
gh repo create rift-view/riftview-website \
  --public \
  --description "Marketing site for RiftView — see what breaks when something breaks" \
  --license MIT \
  --add-readme=false
```

Expected: `https://github.com/rift-view/riftview-website` printed.

- [ ] **Step 2: Verify**

Run:
```bash
gh repo view rift-view/riftview-website --json name,visibility,url
```

Expected: JSON with `"visibility":"PUBLIC"` and the URL above.

---

## Task 2: Initialize the Astro project locally

**Files:**
- Create: `/Users/burkii/riftview-website/` (full directory tree from `npm create astro`)

- [ ] **Step 1: Verify parent directory**

Run:
```bash
ls /Users/burkii/ | grep -E '^riftview-website$' || echo "does not exist (good)"
```

Expected: "does not exist (good)" — confirms the directory hasn't been pre-created.

- [ ] **Step 2: Scaffold Astro project (minimal template, TypeScript strict)**

Run:
```bash
cd /Users/burkii && npm create astro@latest riftview-website -- \
  --template minimal \
  --typescript strict \
  --install \
  --no-git \
  --skip-houston
```

Expected: project created, dependencies installed. Confirm `package.json`, `astro.config.mjs`, `tsconfig.json` exist in `/Users/burkii/riftview-website/`.

- [ ] **Step 3: Add Tailwind CSS 4 via official integration**

Run:
```bash
cd /Users/burkii/riftview-website && npx astro add tailwind --yes
```

Expected: `@tailwindcss/vite` (or `@astrojs/tailwind` for the v4 path) added to `package.json` and `astro.config.mjs` updated.

- [ ] **Step 4: Add @astrojs/sitemap**

Run:
```bash
cd /Users/burkii/riftview-website && npx astro add sitemap --yes
```

Expected: `@astrojs/sitemap` integration added to `astro.config.mjs`.

- [ ] **Step 5: Initialize git and first commit**

Run:
```bash
cd /Users/burkii/riftview-website && git init -b main && git add . && \
  git commit -m "chore: scaffold Astro 5 + Tailwind 4 + sitemap"
```

Expected: clean commit on `main`.

---

## Task 3: Configure project metadata, prettier, gitignore

**Files:**
- Modify: `/Users/burkii/riftview-website/package.json`
- Modify: `/Users/burkii/riftview-website/astro.config.mjs`
- Create: `/Users/burkii/riftview-website/.prettierrc.json`
- Modify: `/Users/burkii/riftview-website/.gitignore`

- [ ] **Step 1: Edit `package.json`**

Set `name`, `description`, `repository`, `license`, `scripts`. Final content:

```json
{
  "name": "riftview-website",
  "type": "module",
  "version": "0.1.0",
  "private": true,
  "description": "Marketing site for RiftView",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/rift-view/riftview-website.git"
  },
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "typecheck": "astro check",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "dependencies": {
    "astro": "^5.0.0",
    "@astrojs/sitemap": "^3.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "prettier-plugin-astro": "^0.14.0",
    "prettier-plugin-tailwindcss": "^0.6.0",
    "typescript": "^5.4.0"
  }
}
```

(If `astro add tailwind` produced different package versions, keep those — only ensure the `name`, `scripts`, `license`, `repository`, and `description` fields match.)

Then:
```bash
cd /Users/burkii/riftview-website && npm install
```

- [ ] **Step 2: Set canonical site in `astro.config.mjs`**

Final content:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://riftview.io',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

- [ ] **Step 3: Create `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  "overrides": [
    { "files": "*.astro", "options": { "parser": "astro" } }
  ]
}
```

- [ ] **Step 4: Append to `.gitignore`**

Append (do not duplicate existing lines):

```
# editor
.vscode/
.idea/
.DS_Store
# env
.env
.env.local
```

- [ ] **Step 5: Commit**

```bash
cd /Users/burkii/riftview-website && git add -A && \
  git commit -m "chore: configure metadata, prettier, gitignore"
```

---

## Task 4: Create the centralized site content module

**Files:**
- Create: `/Users/burkii/riftview-website/src/content/site.ts`

- [ ] **Step 1: Write `src/content/site.ts`**

```ts
export const site = {
  url: 'https://riftview.io',
  name: 'RiftView',
  tagline: 'See what breaks when something breaks.',
  description:
    'RiftView is an incident diagnostic tool for AWS. Click any resource, see every service upstream and downstream, with remediation hints inline.',
  contactEmail: 'jhaxe23@gmail.com',
  github: 'https://github.com/rift-view/riftview',
  org: 'https://github.com/rift-view',
  download: {
    macOs: 'https://github.com/rift-view/riftview/releases/latest',
    windows: 'https://github.com/rift-view/riftview/releases/latest',
    linux: null,
  },
  nav: [
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'GitHub', href: 'https://github.com/rift-view/riftview', external: true },
  ],
  cta: {
    primary: { label: 'Download', href: 'https://github.com/rift-view/riftview/releases/latest' },
    secondary: { label: 'See how it works', href: '#features' },
  },
  legal: {
    awsDisclaimer:
      'RiftView is not affiliated with, endorsed by, or sponsored by Amazon Web Services, Inc. AWS, Amazon EC2, and all related marks are trademarks of Amazon.com, Inc. or its affiliates.',
  },
} as const;

export type Site = typeof site;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/content/site.ts && \
  git commit -m "feat: add centralized site content module"
```

---

## Task 5: Add base styles + Tailwind theme tokens

**Files:**
- Create: `/Users/burkii/riftview-website/src/styles/global.css`

- [ ] **Step 1: Write `src/styles/global.css`**

```css
@import 'tailwindcss';

@theme {
  --color-bg: #0b0d10;
  --color-surface: #11151a;
  --color-surface-2: #1a1f26;
  --color-border: #232931;
  --color-text: #e6edf3;
  --color-text-muted: #9aa6b2;
  --color-accent: #7ee787;
  --color-accent-2: #56d364;
  --color-warn: #ffb454;
  --color-danger: #f0626f;

  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

html {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

body {
  margin: 0;
  min-height: 100dvh;
}

::selection {
  background: var(--color-accent);
  color: var(--color-bg);
}

a {
  color: inherit;
  text-decoration: none;
}

@keyframes pulse-radius {
  0%, 100% { transform: scale(1); opacity: 0.4; }
  50% { transform: scale(1.15); opacity: 0.8; }
}

.pulse-radius {
  animation: pulse-radius 2.4s ease-in-out infinite;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/styles/global.css && \
  git commit -m "feat: add Tailwind theme tokens + base styles"
```

---

## Task 6: Build the Base layout

**Files:**
- Create: `/Users/burkii/riftview-website/src/layouts/Base.astro`

- [ ] **Step 1: Write `src/layouts/Base.astro`**

```astro
---
import '../styles/global.css';
import { site } from '../content/site';
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title?: string;
  description?: string;
  canonicalPath?: string;
}

const {
  title = site.name + ' — ' + site.tagline,
  description = site.description,
  canonicalPath = Astro.url.pathname,
} = Astro.props;

const canonical = new URL(canonicalPath, site.url).toString();
const ogImage = new URL('/og.png', site.url).toString();
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="canonical" href={canonical} />
    <title>{title}</title>
    <meta name="description" content={description} />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={ogImage} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={ogImage} />
  </head>
  <body class="min-h-dvh flex flex-col">
    <Nav />
    <main class="flex-1"><slot /></main>
    <Footer />
  </body>
</html>
```

- [ ] **Step 2: Commit (will be broken until Nav and Footer exist; that's fine — next task fixes it)**

```bash
cd /Users/burkii/riftview-website && git add src/layouts/Base.astro && \
  git commit -m "feat: add Base layout with meta + OG tags"
```

---

## Task 7: Build Nav and Footer

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/Nav.astro`
- Create: `/Users/burkii/riftview-website/src/components/Footer.astro`

- [ ] **Step 1: Write `src/components/Nav.astro`**

```astro
---
import { site } from '../content/site';
---
<header class="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur sticky top-0 z-50">
  <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 font-mono text-sm tracking-tight">
      <span class="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)] pulse-radius" aria-hidden="true"></span>
      <span class="font-semibold">{site.name}</span>
    </a>
    <nav class="flex items-center gap-6 text-sm text-[var(--color-text-muted)]">
      {site.nav.map((item) => (
        <a
          href={item.href}
          class="hover:text-[var(--color-text)] transition-colors"
          {...(item.external ? { rel: 'noopener', target: '_blank' } : {})}
        >
          {item.label}
        </a>
      ))}
      <a
        href={site.cta.primary.href}
        class="px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-medium hover:bg-[var(--color-accent-2)] transition-colors"
      >
        {site.cta.primary.label}
      </a>
    </nav>
  </div>
</header>
```

- [ ] **Step 2: Write `src/components/Footer.astro`**

```astro
---
import { site } from '../content/site';
const year = new Date().getFullYear();
---
<footer class="border-t border-[var(--color-border)] mt-24">
  <div class="max-w-6xl mx-auto px-6 py-12 grid gap-8 md:grid-cols-3 text-sm">
    <div>
      <div class="flex items-center gap-2 font-mono">
        <span class="inline-block w-2 h-2 rounded-full bg-[var(--color-accent)]" aria-hidden="true"></span>
        <span class="font-semibold">{site.name}</span>
      </div>
      <p class="mt-3 text-[var(--color-text-muted)] max-w-xs">{site.description}</p>
    </div>
    <div>
      <div class="font-medium mb-3">Product</div>
      <ul class="space-y-2 text-[var(--color-text-muted)]">
        <li><a href="/#features" class="hover:text-[var(--color-text)]">Features</a></li>
        <li><a href="/pricing" class="hover:text-[var(--color-text)]">Pricing</a></li>
        <li><a href={site.github} class="hover:text-[var(--color-text)]" rel="noopener" target="_blank">GitHub</a></li>
      </ul>
    </div>
    <div>
      <div class="font-medium mb-3">Legal</div>
      <ul class="space-y-2 text-[var(--color-text-muted)]">
        <li><a href="/privacy" class="hover:text-[var(--color-text)]">Privacy</a></li>
        <li><a href="/terms" class="hover:text-[var(--color-text)]">Terms</a></li>
        <li><a href={`mailto:${site.contactEmail}`} class="hover:text-[var(--color-text)]">Contact</a></li>
      </ul>
    </div>
  </div>
  <div class="border-t border-[var(--color-border)]">
    <div class="max-w-6xl mx-auto px-6 py-6 text-xs text-[var(--color-text-muted)] flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
      <span>© {year} {site.name}. MIT-licensed client.</span>
      <span class="max-w-2xl">{site.legal.awsDisclaimer}</span>
    </div>
  </div>
</footer>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/Nav.astro src/components/Footer.astro && \
  git commit -m "feat: add Nav and Footer components"
```

---

## Task 8: Build the Hero component

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/Hero.astro`

- [ ] **Step 1: Write `src/components/Hero.astro`**

```astro
---
import { site } from '../content/site';
---
<section class="relative overflow-hidden">
  <div class="max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 grid gap-12 md:grid-cols-2 md:items-center">
    <div>
      <div class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[var(--color-accent)] mb-6">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] pulse-radius" aria-hidden="true"></span>
        Incident diagnostic layer for AWS
      </div>
      <h1 class="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
        {site.tagline}
      </h1>
      <p class="mt-6 text-lg text-[var(--color-text-muted)] max-w-xl">
        Click any AWS resource. See every service upstream and downstream — hop distance, edge type, remediation hints. The console can't show you this. Diagrams drift. RiftView stays live.
      </p>
      <div class="mt-8 flex flex-wrap items-center gap-4">
        <a
          href={site.cta.primary.href}
          class="px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-medium hover:bg-[var(--color-accent-2)] transition-colors"
        >
          {site.cta.primary.label}
        </a>
        <a
          href={site.cta.secondary.href}
          class="px-5 py-2.5 rounded-md border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-text-muted)] transition-colors"
        >
          {site.cta.secondary.label}
        </a>
      </div>
      <div class="mt-6 text-xs text-[var(--color-text-muted)] font-mono">
        macOS 13+ · Windows in Q3 · Read-only · Credentials never leave your machine
      </div>
    </div>

    <div class="relative">
      <div class="aspect-[4/3] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 relative overflow-hidden">
        <div class="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
          <svg viewBox="0 0 400 300" class="w-full h-full">
            <defs>
              <radialGradient id="grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.4" />
                <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0" />
              </radialGradient>
            </defs>
            <circle cx="200" cy="150" r="120" fill="url(#grad)" />
          </svg>
        </div>
        <div class="relative h-full grid place-items-center">
          <div class="grid gap-4 grid-cols-3 w-full">
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">SQS</div>
            <div class="aspect-square rounded border-2 border-[var(--color-accent)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-accent)] pulse-radius">Lambda</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">DDB</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">SNS</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">APIGW</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">S3</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">RDS</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">SFN</div>
            <div class="aspect-square rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)]">EB</div>
          </div>
        </div>
      </div>
      <div class="mt-3 text-xs text-[var(--color-text-muted)] font-mono text-center">
        Demo clip placeholder — animation swaps in once recorded
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/Hero.astro && \
  git commit -m "feat: add Hero with placeholder blast-radius mock"
```

---

## Task 9: Build Problem section

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/Problem.astro`

- [ ] **Step 1: Write `src/components/Problem.astro`**

```astro
---
const questions = [
  'Which services depend on the broken one?',
  "What's the upstream trigger chain?",
  'Which Lambda talks to that queue, and what else reads from it?',
  'If I roll this back, what else breaks?',
];
---
<section id="problem" class="border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
  <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
    <div class="max-w-3xl">
      <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">The 3am page</div>
      <h2 class="text-3xl md:text-4xl font-semibold tracking-tight">
        Every AWS incident starts with the same questions.
      </h2>
      <p class="mt-5 text-lg text-[var(--color-text-muted)]">
        The first 20 minutes of every page goes to figuring out what's connected to what. The console can't answer it. Diagrams drift from reality. Tribal memory is slow and error-prone.
      </p>
    </div>

    <ol class="mt-12 grid gap-4 md:grid-cols-2">
      {questions.map((q, i) => (
        <li class="flex gap-4 p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <span class="font-mono text-sm text-[var(--color-accent)] shrink-0">0{i + 1}</span>
          <span class="text-[var(--color-text)]">{q}</span>
        </li>
      ))}
    </ol>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/Problem.astro && \
  git commit -m "feat: add Problem section"
```

---

## Task 10: Build FeatureCard primitive + Features section

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/FeatureCard.astro`
- Create: `/Users/burkii/riftview-website/src/components/Features.astro`

- [ ] **Step 1: Write `src/components/FeatureCard.astro`**

```astro
---
interface Props {
  title: string;
  body: string;
  badge?: string;
}
const { title, body, badge } = Astro.props;
---
<article class="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)] transition-colors">
  {badge && (
    <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-accent)] mb-3">{badge}</div>
  )}
  <h3 class="text-lg font-semibold">{title}</h3>
  <p class="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">{body}</p>
</article>
```

- [ ] **Step 2: Write `src/components/Features.astro`**

```astro
---
import FeatureCard from './FeatureCard.astro';

const features = [
  {
    badge: 'Diagnose',
    title: 'Blast radius',
    body: 'Single-click any resource to see what breaks if it fails. Upstream and downstream colored by direction. Hop-distance rings. Everything unrelated dims to focus your attention.',
  },
  {
    badge: 'Map',
    title: 'Live cross-service graph',
    body: 'Scans your entire AWS account in one pass — across every service — and holds it as a connected graph. 24 resource types. SNS→SQS edges via ARN. Always current.',
  },
  {
    badge: 'Triage',
    title: 'Top risks',
    body: 'Immediately after scan, surfaces your highest-severity chain-of-failure risks. Not 40 warnings — the 3 things that will burn you at 3am. Rules gated on real scan metadata.',
  },
  {
    badge: 'Compare',
    title: 'Drift detection',
    body: 'Diffs your live infrastructure against your Terraform state. Shows exactly what drifted, with side-by-side diff and pre-built fix commands.',
  },
  {
    badge: 'Act',
    title: 'Guided remediation',
    body: 'Run AWS CLI fix commands directly from the Inspector. No copy-paste. Optimistic UI updates the graph; auto-rescan confirms the change.',
  },
  {
    badge: 'Operate',
    title: 'Keyboard-first',
    body: 'j/k to traverse, Enter to inspect, r to rescan, ⌘K for search-to-fly. Saved view slots 1–4 for the dashboards you keep coming back to.',
  },
];
---
<section id="features" class="border-t border-[var(--color-border)]">
  <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
    <div class="max-w-3xl">
      <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">What it does</div>
      <h2 class="text-3xl md:text-4xl font-semibold tracking-tight">
        Scan → click → blast radius.
      </h2>
      <p class="mt-5 text-lg text-[var(--color-text-muted)]">
        The graph is the navigation. The Inspector is the command surface. Everything you need to diagnose an incident lives in one window.
      </p>
    </div>

    <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => <FeatureCard {...f} />)}
    </div>
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/FeatureCard.astro src/components/Features.astro && \
  git commit -m "feat: add Features grid with 6 cards"
```

---

## Task 11: Build Differentiation section

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/Differentiation.astro`

- [ ] **Step 1: Write `src/components/Differentiation.astro`**

```astro
---
const comparisons = [
  {
    versus: 'vs. Cloudcraft',
    headline: 'Live, not maintained.',
    body: 'Cloudcraft diagrams drift the moment you ship. RiftView is a view of the account itself — it cannot drift, because it is the source.',
  },
  {
    versus: 'vs. Firefly',
    headline: 'Pre-flight check.',
    body: 'Firefly automates recovery. RiftView is what you look at before you approve their plan. Complementary, not competitive.',
  },
  {
    versus: 'vs. Datadog',
    headline: 'Structure, then metrics.',
    body: 'APM tells you p99 spiked. RiftView tells you which 6 services degrade when it does — because the dependency graph is first-class.',
  },
  {
    versus: 'vs. AWS Console',
    headline: 'One window, one graph.',
    body: 'The console is a browser per service. RiftView is one canvas — click a Lambda, see its SQS, click that, see who reads from it. Escape to go back.',
  },
];
---
<section id="differentiation" class="border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
  <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
    <div class="max-w-3xl">
      <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Where it fits</div>
      <h2 class="text-3xl md:text-4xl font-semibold tracking-tight">
        Different lane than the tools you already pay for.
      </h2>
    </div>

    <div class="mt-12 grid gap-5 md:grid-cols-2">
      {comparisons.map((c) => (
        <div class="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-accent)] mb-2">{c.versus}</div>
          <h3 class="text-lg font-semibold">{c.headline}</h3>
          <p class="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">{c.body}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/Differentiation.astro && \
  git commit -m "feat: add Differentiation section"
```

---

## Task 12: Build UnderTheHood (trust) section

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/UnderTheHood.astro`

- [ ] **Step 1: Write `src/components/UnderTheHood.astro`**

```astro
---
const points = [
  {
    title: 'Credentials never cross the renderer.',
    body: 'AWS SDK reads run in a sandboxed Electron main process. The renderer only sees scan results. CLI writes execute as a subprocess — never SDK writes from a browser context.',
  },
  {
    title: 'Read-only by default.',
    body: 'Scans use read-only API calls. Any write goes through an explicit Inspector action with a CLI preview drawer — no silent mutations.',
  },
  {
    title: 'Your machine, your account.',
    body: 'No telemetry in v1. No backend. The app reads your `~/.aws/credentials` like any other CLI tool and never sends them anywhere.',
  },
  {
    title: 'LocalStack-friendly.',
    body: 'Point the profile at a LocalStack endpoint and the app injects test credentials, clears `AWS_PROFILE`, and routes every call locally. Real credentials are never used for local calls.',
  },
];
---
<section id="security" class="border-t border-[var(--color-border)]">
  <div class="max-w-6xl mx-auto px-6 py-20 md:py-28">
    <div class="max-w-3xl">
      <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Under the hood</div>
      <h2 class="text-3xl md:text-4xl font-semibold tracking-tight">
        Built for credential paranoia.
      </h2>
      <p class="mt-5 text-lg text-[var(--color-text-muted)]">
        A desktop tool you trust with your AWS keys has to deserve that trust. Here's how the boundaries work.
      </p>
    </div>

    <div class="mt-12 grid gap-5 md:grid-cols-2">
      {points.map((p) => (
        <div class="p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <h3 class="text-base font-semibold">{p.title}</h3>
          <p class="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed">{p.body}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/UnderTheHood.astro && \
  git commit -m "feat: add UnderTheHood (trust) section"
```

---

## Task 13: Build Pilot CTA section

**Files:**
- Create: `/Users/burkii/riftview-website/src/components/Pilot.astro`

- [ ] **Step 1: Write `src/components/Pilot.astro`**

```astro
---
import { site } from '../content/site';
---
<section id="pilot" class="border-t border-[var(--color-border)] bg-[var(--color-surface)]/60">
  <div class="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
    <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-accent)] mb-4">Free pilot · 30 days</div>
    <h2 class="text-3xl md:text-4xl font-semibold tracking-tight">
      Try it on your account.
    </h2>
    <p class="mt-5 text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
      No credit card. No SSO setup. Install the dmg, point it at your AWS profile, hit scan. If the blast-radius view doesn't change how you think about your account in 10 minutes, uninstall it.
    </p>
    <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
      <a
        href={site.download.macOs}
        class="px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-medium hover:bg-[var(--color-accent-2)] transition-colors"
      >
        Download for macOS
      </a>
      <a
        href={`mailto:${site.contactEmail}?subject=RiftView%20pilot`}
        class="px-5 py-2.5 rounded-md border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-text-muted)] transition-colors"
      >
        Email the founder
      </a>
    </div>
    <div class="mt-6 text-xs text-[var(--color-text-muted)] font-mono">
      Windows build in Q3 · Linux planned · Source: <a href={site.github} class="underline hover:text-[var(--color-text)]">github.com/rift-view/riftview</a>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/components/Pilot.astro && \
  git commit -m "feat: add Pilot CTA section"
```

---

## Task 14: Compose the landing page

**Files:**
- Replace: `/Users/burkii/riftview-website/src/pages/index.astro` (Astro template ships a placeholder)

- [ ] **Step 1: Write `src/pages/index.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import Hero from '../components/Hero.astro';
import Problem from '../components/Problem.astro';
import Features from '../components/Features.astro';
import Differentiation from '../components/Differentiation.astro';
import UnderTheHood from '../components/UnderTheHood.astro';
import Pilot from '../components/Pilot.astro';
---
<Base>
  <Hero />
  <Problem />
  <Features />
  <Differentiation />
  <UnderTheHood />
  <Pilot />
</Base>
```

- [ ] **Step 2: Smoke test the build**

Run:
```bash
cd /Users/burkii/riftview-website && npm run build
```

Expected: build succeeds, `dist/index.html` exists, no errors.

- [ ] **Step 3: Local preview check**

Run (in background):
```bash
cd /Users/burkii/riftview-website && npm run preview
```

Open `http://localhost:4321` in a browser, verify the page renders end-to-end without console errors. Stop the preview server.

- [ ] **Step 4: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/pages/index.astro && \
  git commit -m "feat: compose landing page from sections"
```

---

## Task 15: Build the Pricing page

**Files:**
- Create: `/Users/burkii/riftview-website/src/pages/pricing.astro`

- [ ] **Step 1: Write `src/pages/pricing.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { site } from '../content/site';

const tiers = [
  {
    name: 'Pilot',
    price: 'Free',
    period: '30 days',
    target: 'Anyone evaluating RiftView',
    cta: { label: 'Download', href: site.download.macOs },
    features: [
      'Full feature access',
      'Single machine, single AWS account',
      'Direct email support from founder',
      'No credit card required',
    ],
    highlight: true,
  },
  {
    name: 'Individual',
    price: '$19',
    period: 'per month',
    target: 'Solo founders, consultants, individual platform engineers',
    cta: { label: 'Email to start', href: `mailto:${site.contactEmail}?subject=RiftView%20Individual` },
    features: [
      '1 user, unlimited AWS accounts',
      'All diagnostic features',
      'Email support',
      '50% off for YC / early-stage startups',
    ],
  },
  {
    name: 'Team',
    price: '$49',
    period: 'per user / month',
    target: '3–30 person engineering teams',
    cta: { label: 'Email to start', href: `mailto:${site.contactEmail}?subject=RiftView%20Team` },
    features: [
      'Min 3 seats',
      'Shared saved views across teammates',
      'Team-wide advisory rule customization',
      'Slack integration for blast radius sharing',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Contact',
    period: '',
    target: '50+ person orgs, regulated industries',
    cta: { label: 'Talk to founder', href: `mailto:${site.contactEmail}?subject=RiftView%20Enterprise` },
    features: [
      'SSO / SAML',
      'SOC 2 Type II documentation',
      'Air-gapped / on-prem deployment option',
      'SLA with response-time guarantees',
      'Volume licensing',
    ],
  },
];
---
<Base
  title="Pricing — RiftView"
  description="Free 30-day pilot. $19/mo Individual. $49/user/mo Team. Enterprise on request."
  canonicalPath="/pricing"
>
  <section class="max-w-6xl mx-auto px-6 py-20 md:py-28">
    <div class="max-w-3xl">
      <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Pricing</div>
      <h1 class="text-4xl md:text-5xl font-semibold tracking-tight">Per-user. No infrastructure tax.</h1>
      <p class="mt-5 text-lg text-[var(--color-text-muted)]">
        We don't bill on your AWS spend. We don't bill per resource. One simple per-user fee that aligns our incentives with yours.
      </p>
    </div>

    <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {tiers.map((t) => (
        <div class={`p-6 rounded-lg border bg-[var(--color-surface)] flex flex-col ${t.highlight ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
          <div class="flex items-baseline gap-2">
            <h3 class="text-lg font-semibold">{t.name}</h3>
            {t.highlight && <span class="font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">Start here</span>}
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-semibold">{t.price}</span>
            {t.period && <span class="text-xs text-[var(--color-text-muted)]">{t.period}</span>}
          </div>
          <p class="mt-3 text-sm text-[var(--color-text-muted)]">{t.target}</p>
          <ul class="mt-4 space-y-2 text-sm text-[var(--color-text)] flex-1">
            {t.features.map((f) => (
              <li class="flex gap-2"><span class="text-[var(--color-accent)] shrink-0">→</span><span>{f}</span></li>
            ))}
          </ul>
          <a
            href={t.cta.href}
            class={`mt-6 px-4 py-2 rounded-md text-sm font-medium text-center transition-colors ${t.highlight ? 'bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-2)]' : 'border border-[var(--color-border)] hover:border-[var(--color-text-muted)]'}`}
          >
            {t.cta.label}
          </a>
        </div>
      ))}
    </div>

    <div class="mt-16 grid gap-5 md:grid-cols-3 text-sm text-[var(--color-text-muted)]">
      <div class="p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div class="font-medium text-[var(--color-text)] mb-2">Annual prepay</div>
        15% off any plan when paid annually.
      </div>
      <div class="p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div class="font-medium text-[var(--color-text)] mb-2">Open-source maintainers</div>
        Free Individual tier, lifetime. Email us your repo.
      </div>
      <div class="p-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div class="font-medium text-[var(--color-text)] mb-2">Students</div>
        Free Individual tier with a .edu email.
      </div>
    </div>
  </section>
</Base>
```

- [ ] **Step 2: Verify build still passes**

Run:
```bash
cd /Users/burkii/riftview-website && npm run build
```

Expected: build succeeds, `dist/pricing/index.html` exists.

- [ ] **Step 3: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/pages/pricing.astro && \
  git commit -m "feat: add pricing page"
```

---

## Task 16: Build Privacy and Terms pages

**Files:**
- Create: `/Users/burkii/riftview-website/src/pages/privacy.astro`
- Create: `/Users/burkii/riftview-website/src/pages/terms.astro`

- [ ] **Step 1: Write `src/pages/privacy.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { site } from '../content/site';
const updated = '2026-04-19';
---
<Base
  title="Privacy — RiftView"
  description="How RiftView handles AWS credentials, scan data, and user information."
  canonicalPath="/privacy"
>
  <section class="max-w-3xl mx-auto px-6 py-20 md:py-28 prose prose-invert">
    <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Privacy · v1 draft · last updated {updated}</div>
    <h1 class="text-4xl font-semibold tracking-tight">Privacy</h1>

    <h2 class="mt-10 text-xl font-semibold">What RiftView reads</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      RiftView reads your local AWS credentials (from <code>~/.aws/credentials</code>, environment variables, or your configured profile) and uses them to make read-only API calls against your AWS account. No write API is called automatically — every write happens via the AWS CLI subprocess after explicit user action in the Inspector.
    </p>

    <h2 class="mt-8 text-xl font-semibold">Where the data goes</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      Nowhere. The application has no backend. Scan results stay on your machine, in memory, for the life of the session. Saved views and node positions persist locally via Electron's userData directory. Credentials never cross the renderer boundary and are never transmitted to any RiftView-controlled server.
    </p>

    <h2 class="mt-8 text-xl font-semibold">Telemetry</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      v1 ships with no telemetry. If we add opt-in crash reporting in a future release, it will require explicit consent and will be limited to stack traces — no credentials, no resource data, no account identifiers.
    </p>

    <h2 class="mt-8 text-xl font-semibold">Marketing site</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      This site (<a class="underline" href={site.url}>{site.url}</a>) is statically hosted. No third-party analytics or trackers are loaded in v1. If we add analytics later, it will be a privacy-respecting tool (Plausible-style) and disclosed here.
    </p>

    <h2 class="mt-8 text-xl font-semibold">Contact</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      Questions or data requests: <a class="underline" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
    </p>

    <p class="mt-12 text-xs text-[var(--color-text-muted)]">
      This is a v1 draft, not a lawyer-reviewed policy. We will replace it with a reviewed version before any paid plans launch.
    </p>
  </section>
</Base>
```

- [ ] **Step 2: Write `src/pages/terms.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import { site } from '../content/site';
const updated = '2026-04-19';
---
<Base
  title="Terms — RiftView"
  description="Pilot terms for the RiftView desktop application."
  canonicalPath="/terms"
>
  <section class="max-w-3xl mx-auto px-6 py-20 md:py-28">
    <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-4">Terms · v1 draft · last updated {updated}</div>
    <h1 class="text-4xl font-semibold tracking-tight">Terms</h1>

    <h2 class="mt-10 text-xl font-semibold">Pilot</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      The RiftView pilot is free for 30 days from first launch on a given machine. No credit card is required. After 30 days, continued use requires an Individual, Team, or Enterprise plan as described on the <a class="underline" href="/pricing">pricing page</a>.
    </p>

    <h2 class="mt-8 text-xl font-semibold">License</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      The RiftView client is distributed under the MIT license (see the LICENSE file in the source repository at <a class="underline" href={site.github}>{site.github}</a>). Source-available code is yours to inspect, fork, and run.
    </p>

    <h2 class="mt-8 text-xl font-semibold">No warranty</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      RiftView is provided "as is" without warranty of any kind. You are responsible for the AWS API calls made through the application, including any costs they incur. We recommend using a least-privilege IAM role.
    </p>

    <h2 class="mt-8 text-xl font-semibold">Acceptable use</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      You agree to use RiftView only against AWS accounts you own or are authorized to operate. You agree not to use the application to evade access controls or to facilitate unauthorized access to third-party infrastructure.
    </p>

    <h2 class="mt-8 text-xl font-semibold">Trademarks</h2>
    <p class="mt-3 text-[var(--color-text-muted)]">
      {site.legal.awsDisclaimer}
    </p>

    <p class="mt-12 text-xs text-[var(--color-text-muted)]">
      This is a v1 draft, not a lawyer-reviewed agreement. We will replace it with a reviewed version before any paid plans launch.
    </p>
  </section>
</Base>
```

- [ ] **Step 3: Verify build**

Run:
```bash
cd /Users/burkii/riftview-website && npm run build
```

Expected: `dist/privacy/index.html` and `dist/terms/index.html` exist.

- [ ] **Step 4: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/pages/privacy.astro src/pages/terms.astro && \
  git commit -m "feat: add privacy and terms pages (v1 draft)"
```

---

## Task 17: Add 404 page

**Files:**
- Create: `/Users/burkii/riftview-website/src/pages/404.astro`

- [ ] **Step 1: Write `src/pages/404.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base
  title="404 — RiftView"
  description="Page not found"
  canonicalPath="/404"
>
  <section class="max-w-2xl mx-auto px-6 py-32 text-center">
    <div class="font-mono text-xs uppercase tracking-wider text-[var(--color-accent)] mb-4">404</div>
    <h1 class="text-4xl md:text-5xl font-semibold tracking-tight">Page not found.</h1>
    <p class="mt-5 text-[var(--color-text-muted)]">
      The page you're looking for doesn't exist. Maybe it never did. Maybe it drifted.
    </p>
    <a href="/" class="mt-8 inline-block px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-medium hover:bg-[var(--color-accent-2)] transition-colors">
      Back to landing
    </a>
  </section>
</Base>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add src/pages/404.astro && \
  git commit -m "feat: add 404 page"
```

---

## Task 18: Add public assets (favicon, og placeholder, robots.txt)

**Files:**
- Create: `/Users/burkii/riftview-website/public/favicon.svg`
- Create: `/Users/burkii/riftview-website/public/robots.txt`
- Verify: `/Users/burkii/riftview-website/public/og.png` (placeholder, will be regenerated later)

- [ ] **Step 1: Write `public/favicon.svg`**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#0b0d10"/>
  <circle cx="16" cy="16" r="9" fill="none" stroke="#7ee787" stroke-width="2" opacity="0.4"/>
  <circle cx="16" cy="16" r="5" fill="#7ee787"/>
</svg>
```

- [ ] **Step 2: Write `public/robots.txt`**

```
User-agent: *
Allow: /
Sitemap: https://riftview.io/sitemap-index.xml
```

- [ ] **Step 3: Create OG image placeholder**

Run:
```bash
cd /Users/burkii/riftview-website && \
  python3 -c "
from struct import pack
import zlib
# Minimal 1200x630 black PNG placeholder. Real OG image to be designed separately.
w, h = 1200, 630
def chunk(t, d):
    return pack('>I', len(d)) + t + d + pack('>I', zlib.crc32(t + d) & 0xffffffff)
sig = b'\x89PNG\r\n\x1a\n'
ihdr = chunk(b'IHDR', pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
raw = b''.join(b'\x00' + b'\x0b\x0d\x10' * w for _ in range(h))
idat = chunk(b'IDAT', zlib.compress(raw, 9))
iend = chunk(b'IEND', b'')
open('public/og.png', 'wb').write(sig + ihdr + idat + iend)
"
```

Expected: `public/og.png` exists, ~few KB.

- [ ] **Step 4: Verify build**

Run:
```bash
cd /Users/burkii/riftview-website && npm run build
```

Expected: assets copied to `dist/` (favicon.svg, og.png, robots.txt).

- [ ] **Step 5: Commit**

```bash
cd /Users/burkii/riftview-website && git add public/ && \
  git commit -m "feat: add favicon, og placeholder, robots.txt"
```

---

## Task 19: Add CI workflow (build verification)

**Files:**
- Create: `/Users/burkii/riftview-website/.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run format:check
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist
          retention-days: 7
```

- [ ] **Step 2: Run formatter once so `format:check` will pass**

Run:
```bash
cd /Users/burkii/riftview-website && npx prettier --write .
```

- [ ] **Step 3: Verify lint, typecheck, build all pass locally**

Run:
```bash
cd /Users/burkii/riftview-website && \
  npm run format:check && npm run typecheck && npm run build
```

Expected: all three exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/burkii/riftview-website && git add -A && \
  git commit -m "ci: add build verification workflow"
```

---

## Task 20: Write the README

**Files:**
- Create: `/Users/burkii/riftview-website/README.md`

- [ ] **Step 1: Write `README.md`**

````markdown
# riftview-website

Marketing site for [RiftView](https://github.com/rift-view/riftview) — the incident diagnostic layer AWS doesn't have.

Production: https://riftview.io

## Stack

- Astro 5
- Tailwind CSS 4
- TypeScript (strict)
- Static output → S3 + CloudFront

## Develop

```bash
npm install
npm run dev          # http://localhost:4321
npm run typecheck
npm run format
npm run build        # → dist/
npm run preview      # serve dist/ locally
```

## Deploy (S3 + CloudFront)

The site builds to a fully static `dist/` directory. There is no SSR, no edge functions, no runtime.

One-time setup (outside this repo):
1. Create S3 bucket (e.g. `riftview-io-site`), block public access.
2. Create CloudFront distribution with Origin Access Control (OAC), S3 origin.
3. Configure CloudFront Functions or behavior for SPA-style routing if needed (Astro generates per-route `index.html`, so this is usually unnecessary).
4. Route 53 alias record from `riftview.io` to the CloudFront distribution.

Per release:

```bash
npm ci
npm run build
aws s3 sync dist/ s3://riftview-io-site/ --delete
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths '/*'
```

## Content

All copy lives in components under `src/components/` and pages under `src/pages/`. Source material is in the app repo at `riftview/docs/outreach/` and `riftview/docs/POSITIONING.md`. Update those first if positioning changes, then propagate.

Centralized site metadata (URL, contact email, nav links, CTAs) lives in `src/content/site.ts`. Domain change = single-file edit.

## License

MIT — see [LICENSE](./LICENSE).
````

- [ ] **Step 2: Commit**

```bash
cd /Users/burkii/riftview-website && git add README.md && \
  git commit -m "docs: add README with dev + deploy instructions"
```

---

## Task 21: Push to remote and verify CI

**Files:** none.

- [ ] **Step 1: Add remote and push**

Run:
```bash
cd /Users/burkii/riftview-website && \
  git remote add origin https://github.com/rift-view/riftview-website.git && \
  git push -u origin main
```

Expected: push succeeds.

- [ ] **Step 2: Verify CI runs**

Run:
```bash
gh run list --repo rift-view/riftview-website --limit 1
```

Expected: a `ci` run, in progress or completed.

- [ ] **Step 3: Wait for CI completion and verify green**

Run:
```bash
gh run watch --repo rift-view/riftview-website --exit-status
```

Expected: exits 0 (all jobs green).

If CI fails, fix the issue locally, commit, push, and re-run `gh run watch`. Do not skip hooks or force-push.

---

## Task 22: Final smoke test

**Files:** none.

- [ ] **Step 1: Build clean**

Run:
```bash
cd /Users/burkii/riftview-website && rm -rf dist && npm run build
```

Expected: build succeeds.

- [ ] **Step 2: Local serve and manual click-through**

Run (background):
```bash
cd /Users/burkii/riftview-website && npm run preview
```

Open `http://localhost:4321` in a browser. Verify:
- Landing page renders end-to-end
- Nav links to `/pricing`, `/#features`, GitHub all work
- Footer links to `/privacy`, `/terms`, mailto contact, GitHub all work
- `/404` (visit a bogus URL) renders the styled 404
- No console errors
- Dark theme tokens render correctly (no flashes of unstyled content)

Stop the preview server.

- [ ] **Step 3: Confirm spec acceptance criteria**

Manually verify against `docs/superpowers/specs/2026-04-19-riftview-website-design.md` § Acceptance criteria:
- ✅ `npm run build` produces a `dist/` that passes local smoke test
- ⚠️ Lighthouse scores: defer until OG image and demo clip are real (placeholders today)
- ✅ All links resolve from landing
- ✅ CI green on `main`
- ✅ Hero, problem, pilot copy match the source `one-pager.md`

- [ ] **Step 4: Notify user**

Report to user:
- Repo: https://github.com/rift-view/riftview-website
- CI status: green
- Local dev: `cd /Users/burkii/riftview-website && npm run dev`
- Deploy command snippets in `README.md`
- Outstanding: real demo clip + OG image + Lighthouse pass after assets land

---

## Spec coverage check

| Spec section | Covered by |
|---|---|
| Hosting + domain | Tasks 3 (canonical URL), 20 (deploy doc) |
| Stack choices | Tasks 2, 3 |
| Pages | Tasks 14, 15, 16, 17 |
| Landing page sections | Tasks 8–13 |
| Visual direction | Task 5 (tokens), Tasks 7–13 (component styling) |
| Repo layout | Match by tree at top of plan |
| CI | Task 19 |
| Deploy doc | Task 20 |
| A11y + SEO baseline | Task 6 (meta tags), Task 18 (favicon, robots, sitemap), Task 7 (semantic Nav/Footer) |
| Performance budget | Task 22 verifies build; Lighthouse deferred per acceptance |
| Content sourcing | Hard-coded into components 8–13 |
| Open questions resolved | Q1 demo placeholder (Task 8), Q2 personal email (Task 4), Q3 v1 boilerplate legal (Task 16) |
| Acceptance criteria | Task 22 step 3 |

No gaps.
