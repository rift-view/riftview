/**
 * Thin internal REST wrapper around the Hetzner Cloud API.
 *
 * Zero npm deps — uses the global `fetch` (Node 20+ provides it). No
 * `@hcloud/*`, no axios, no got, no `https`/`http` imports.
 *
 * Security:
 *   - The bearer token is only used inside this module to construct an
 *     `Authorization` header. It never appears in error messages, log
 *     output, or thrown stacks. Errors include status + path only.
 *   - Callers pass credentials in via `createHetznerClient`; the token
 *     itself is closed over and never exposed back through the public
 *     `HetznerClient` surface.
 *
 * Pagination:
 *   - Hetzner returns paged JSON like
 *     `{ <key>: T[], meta: { pagination: { next_page: number | null } } }`.
 *   - `list()` walks `next_page` until it is null, concatenating results.
 *
 * Rate limiting:
 *   - On 429, `Retry-After` (seconds) is honoured up to one retry per call.
 *     Anything more sophisticated is overkill for v1.
 */

export interface HetznerCredentials {
  readonly token: string
}

export interface HetznerClient {
  /**
   * GET `path` (e.g. `/servers`) and return the array under the matching
   * top-level key (e.g. `response.servers`). Walks pagination until done.
   */
  list<T>(path: string, key: string): Promise<T[]>
}

interface HetznerListResponse {
  meta?: {
    pagination?: {
      next_page?: number | null
    }
  }
  [key: string]: unknown
}

const BASE_URL = 'https://api.hetzner.cloud/v1'

/**
 * Build a token-free error message — never reveal Authorization headers
 * or any credential material in thrown errors / stack traces.
 */
function makeError(status: number, path: string, hint?: string): Error {
  const suffix = hint ? ` (${hint})` : ''
  return new Error(`hetzner: GET ${path} → HTTP ${status}${suffix}`)
}

function joinUrl(path: string, page: number | null): string {
  const sep = path.includes('?') ? '&' : '?'
  const query = page === null ? '' : `${sep}page=${page}&per_page=50`
  return `${BASE_URL}${path}${query}`
}

async function fetchPage(
  path: string,
  page: number | null,
  token: string,
  attempt = 0
): Promise<HetznerListResponse> {
  const url = joinUrl(path, page)
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  })

  if (response.status === 429 && attempt === 0) {
    const retryAfter = Number(response.headers.get('Retry-After') ?? '1')
    const delayMs = Math.max(0, Math.min(retryAfter, 5)) * 1000
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
    return fetchPage(path, page, token, attempt + 1)
  }

  if (!response.ok) {
    throw makeError(response.status, path)
  }

  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw makeError(response.status, path, 'invalid JSON body')
  }

  if (json === null || typeof json !== 'object') {
    throw makeError(response.status, path, 'unexpected response shape')
  }
  return json as HetznerListResponse
}

export function createHetznerClient(creds: HetznerCredentials): HetznerClient {
  // Capture the token in a closure — never leaks back through the
  // returned interface.
  const token = creds.token

  return {
    async list<T>(path: string, key: string): Promise<T[]> {
      const all: T[] = []
      let page: number | null = 1

      while (page !== null) {
        const body = await fetchPage(path, page, token)
        const slice = body[key]
        if (Array.isArray(slice)) {
          all.push(...(slice as T[]))
        }
        const next = body.meta?.pagination?.next_page
        page = typeof next === 'number' ? next : null
      }

      return all
    }
  }
}
