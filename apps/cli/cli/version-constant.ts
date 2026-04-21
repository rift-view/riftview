// Resolved at build time by esbuild `define`. In dev (tsx), falls back
// to reading package.json directly so tests and `tsx` invocations work.

declare const __RIFTVIEW_VERSION__: string | undefined
declare const __RIFTVIEW_COMMIT__: string | undefined
declare const __RIFTVIEW_BUILD_DATE__: string | undefined

function readPkgVersion(): string {
  try {
    // Lazy require keeps the bundled build free of fs; only runs in dev.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = require('../package.json')
    return pkg.version ?? '0.0.0-dev'
  } catch {
    return '0.0.0-dev'
  }
}

export const PKG_VERSION: string =
  typeof __RIFTVIEW_VERSION__ === 'string' ? __RIFTVIEW_VERSION__ : readPkgVersion()

export const PKG_COMMIT: string =
  typeof __RIFTVIEW_COMMIT__ === 'string' ? __RIFTVIEW_COMMIT__ : 'dev'

export const PKG_BUILD_DATE: string =
  typeof __RIFTVIEW_BUILD_DATE__ === 'string' ? __RIFTVIEW_BUILD_DATE__ : 'dev'
