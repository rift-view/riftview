#!/usr/bin/env tsx
// Bundles the CLI into a single CommonJS file with a node shebang.
// Belt-and-suspenders: `external: ['electron']` prevents accidental pulls
// from @riftview/shared (which should never import electron anyway).

import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { readFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'

const ROOT = dirname(new URL(import.meta.url).pathname).replace(/\/scripts$/, '')
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  } catch {
    return 'unknown'
  }
}

async function main(): Promise<void> {
  const outDir = join(ROOT, 'out')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  const entry = join(ROOT, 'cli', 'bin.ts')
  const outfile = join(outDir, 'index.js')

  await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    outfile,
    external: ['electron'],
    banner: { js: '#!/usr/bin/env node' },
    define: {
      __RIFTVIEW_VERSION__: JSON.stringify(PKG.version),
      __RIFTVIEW_COMMIT__: JSON.stringify(process.env.RIFTVIEW_COMMIT ?? gitCommit()),
      __RIFTVIEW_BUILD_DATE__: JSON.stringify(
        process.env.RIFTVIEW_BUILD_DATE ?? new Date().toISOString()
      )
    },
    logLevel: 'warning'
  })

  chmodSync(outfile, 0o755)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
