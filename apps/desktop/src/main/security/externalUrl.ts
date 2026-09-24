/**
 * Allow-list for URLs the renderer may ask the main process to hand to the
 * OS browser (RIFT-146). Pure and Electron-free so it can be unit-tested
 * without the electron mock.
 *
 * The renderer only ever builds AWS console links (see
 * renderer/utils/buildConsoleUrl.ts). Every host that module can emit today:
 *
 *   - console.aws.amazon.com      (every service console)
 *   - s3.console.aws.amazon.com   (S3 buckets)
 *
 * Regional consoles redirect to `<region>.console.aws.amazon.com`, so the
 * only wildcard allowed is "a subdomain of console.aws.amazon.com". Nothing
 * outside that domain is reachable from the app, and no other scheme is:
 * http, javascript:, file:, data: and friends are all refused.
 */

const CONSOLE_HOST = 'console.aws.amazon.com'

function isConsoleHost(hostname: string): boolean {
  return hostname === CONSOLE_HOST || hostname.endsWith(`.${CONSOLE_HOST}`)
}

export function isAllowedExternalUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  // `https://console.aws.amazon.com@evil.example` parses with the console
  // host as *username* and evil.example as the host. The hostname check below
  // already refuses it; rejecting any userinfo makes the intent explicit and
  // also drops `https://user:pw@console.aws.amazon.com`, which the app never
  // generates.
  if (parsed.username !== '' || parsed.password !== '') return false
  // buildConsoleUrl never emits a port; a non-default one is not a console URL.
  if (parsed.port !== '') return false

  return isConsoleHost(parsed.hostname)
}
