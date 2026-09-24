/**
 * Navigation policy for the main BrowserWindow (RIFT-146). The renderer is a
 * single-page app: the only document it may ever (re)load is its own — the
 * bundled `file://…/renderer/index.html`, or the Vite dev server URL under
 * `electron-vite dev`. Anything else (a dropped file, a dragged link, a
 * scripted `location.href = …`) is refused by the `will-navigate` guard.
 *
 * Pure and Electron-free so it can be unit-tested directly.
 */
export function isAppNavigation(target: string, appUrl: string): boolean {
  let t: URL
  let a: URL
  try {
    t = new URL(target)
    a = new URL(appUrl)
  } catch {
    return false
  }
  // Same document: scheme, host (incl. port) and path must all match. Query
  // and fragment are irrelevant — they cannot change which document loads.
  return t.protocol === a.protocol && t.host === a.host && t.pathname === a.pathname
}
