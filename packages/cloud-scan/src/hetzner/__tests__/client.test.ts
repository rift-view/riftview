import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHetznerClient } from '../client'

const TOKEN = 'fake-test-token-not-real'

describe('createHetznerClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
      ...init
    })
  }

  it('returns a single page array directly', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        servers: [{ id: 1 }, { id: 2 }],
        meta: { pagination: { next_page: null } }
      })
    )

    const client = createHetznerClient({ token: TOKEN })
    const result = await client.list<{ id: number }>('/servers', 'servers')

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('walks pagination across multiple pages and concatenates results', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          servers: [{ id: 1 }],
          meta: { pagination: { next_page: 2 } }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          servers: [{ id: 2 }, { id: 3 }],
          meta: { pagination: { next_page: 3 } }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          servers: [{ id: 4 }],
          meta: { pagination: { next_page: null } }
        })
      )

    const client = createHetznerClient({ token: TOKEN })
    const result = await client.list<{ id: number }>('/servers', 'servers')

    expect(result.map((s) => s.id)).toEqual([1, 2, 3, 4])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('sends Authorization header with bearer token', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ servers: [], meta: { pagination: { next_page: null } } })
    )

    const client = createHetznerClient({ token: TOKEN })
    await client.list('/servers', 'servers')

    const [, init] = fetchMock.mock.calls[0]
    const headers = (init as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`)
  })

  it('throws on 401 without leaking the token', async () => {
    fetchMock.mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))

    const client = createHetznerClient({ token: TOKEN })

    await expect(client.list('/servers', 'servers')).rejects.toThrow(/HTTP 401/)
    await expect(client.list('/servers', 'servers')).rejects.not.toThrow(new RegExp(TOKEN))
  })

  it('throws on 403 without leaking the token', async () => {
    fetchMock.mockResolvedValue(new Response('forbidden', { status: 403 }))

    const client = createHetznerClient({ token: TOKEN })

    try {
      await client.list('/servers', 'servers')
      expect.fail('expected throw')
    } catch (err) {
      const message = (err as Error).message
      expect(message).toMatch(/HTTP 403/)
      expect(message).not.toContain(TOKEN)
      expect(message).not.toMatch(/Authorization/i)
    }
  })

  it('retries once on 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '0' }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ servers: [{ id: 7 }], meta: { pagination: { next_page: null } } })
      )

    const client = createHetznerClient({ token: TOKEN })
    const result = await client.list<{ id: number }>('/servers', 'servers')

    expect(result).toEqual([{ id: 7 }])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws on a second consecutive 429', async () => {
    fetchMock.mockResolvedValue(
      new Response('still rate limited', {
        status: 429,
        headers: { 'Retry-After': '0' }
      })
    )

    const client = createHetznerClient({ token: TOKEN })

    await expect(client.list('/servers', 'servers')).rejects.toThrow(/HTTP 429/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not include Authorization header value in the thrown error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))

    const client = createHetznerClient({ token: TOKEN })
    try {
      await client.list('/servers', 'servers')
      expect.fail('expected throw')
    } catch (err) {
      const stack = (err as Error).stack ?? ''
      const message = (err as Error).message
      expect(message + stack).not.toContain(TOKEN)
    }
  })
})
