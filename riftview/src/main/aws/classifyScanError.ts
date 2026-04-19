export type ScanErrorKind =
  | 'credentials-expired'
  | 'credentials-invalid'
  | 'network'
  | 'throttle'
  | 'permission'
  | 'region-disabled'
  | 'unknown'

export interface ScanErrorDetail {
  kind:    ScanErrorKind
  message: string      // human-readable, actionable
  raw:     string      // original error message for copy/report
}

/**
 * Classify a caught error from the scan loop into an actionable category +
 * human-readable message. Pure function — no logging, no Electron APIs.
 */
export function classifyScanError(err: unknown): ScanErrorDetail {
  const raw = err instanceof Error ? err.message : String(err)
  const msg = raw.toLowerCase()

  if (msg.includes('expired') || msg.includes('token has expired') || msg.includes('sso session has expired')) {
    return {
      kind:    'credentials-expired',
      message: 'AWS credentials expired. Run `aws sso login` (or re-auth your profile) and rescan.',
      raw,
    }
  }

  if (msg.includes('invalidclienttoken') || msg.includes('signaturedoesnotmatch') || msg.includes('authfailure') || msg.includes('unable to locate credentials')) {
    return {
      kind:    'credentials-invalid',
      message: 'AWS credentials invalid. Check profile name, access keys, or `~/.aws/credentials`.',
      raw,
    }
  }

  if (msg.includes('accessdenied') || msg.includes('unauthorizedoperation') || msg.includes('not authorized')) {
    return {
      kind:    'permission',
      message: 'IAM permission missing. See the onboarding panel for the required read-only actions.',
      raw,
    }
  }

  if (msg.includes('throttling') || msg.includes('ratelimit') || msg.includes('too many requests')) {
    return {
      kind:    'throttle',
      message: 'AWS is throttling requests. Wait a few seconds and rescan.',
      raw,
    }
  }

  if (msg.includes('optinrequired') || msg.includes('region not enabled') || msg.includes('region is disabled')) {
    return {
      kind:    'region-disabled',
      message: 'Region not enabled on this account. Opt in via AWS Console → Account Settings.',
      raw,
    }
  }

  if (msg.includes('getaddrinfo') || msg.includes('enotfound') || msg.includes('econnrefused') || msg.includes('etimedout') || msg.includes('network') || msg.includes('timeout')) {
    return {
      kind:    'network',
      message: 'Network error reaching AWS. Check your connection or VPN.',
      raw,
    }
  }

  return {
    kind:    'unknown',
    message: `Scan failed: ${raw}`,
    raw,
  }
}
