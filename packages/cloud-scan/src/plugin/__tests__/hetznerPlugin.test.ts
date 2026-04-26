import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn() }))

vi.mock('../../hetzner/services/server', () => ({
  scanServers: vi.fn().mockResolvedValue([])
}))

vi.mock('../../hetzner/services/network', () => ({
  scanNetworks: vi.fn().mockResolvedValue([])
}))

vi.mock('../../hetzner/services/volume', () => ({
  scanVolumes: vi.fn().mockResolvedValue([])
}))

vi.mock('../../hetzner/services/firewall', () => ({
  scanFirewalls: vi.fn().mockResolvedValue([])
}))

vi.mock('../../hetzner/services/sshKey', () => ({
  scanSshKeys: vi.fn().mockResolvedValue([])
}))

const HETZNER_NODE_TYPES = [
  'hetzner:server',
  'hetzner:network',
  'hetzner:volume',
  'hetzner:firewall',
  'hetzner:ssh-key'
] as const

describe('hetznerPlugin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hetznerPlugin: any
  const originalEnv = process.env.HETZNER_API_TOKEN

  beforeEach(async () => {
    vi.resetModules()
    process.env.HETZNER_API_TOKEN = 'fake-test-token-not-real'
    const mod = await import('../hetznerPlugin')
    hetznerPlugin = mod.hetznerPlugin
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HETZNER_API_TOKEN
    } else {
      process.env.HETZNER_API_TOKEN = originalEnv
    }
  })

  it('has id "com.riftview.hetzner"', () => {
    expect(hetznerPlugin.id).toBe('com.riftview.hetzner')
  })

  it('has displayName "Hetzner Cloud"', () => {
    expect(hetznerPlugin.displayName).toBe('Hetzner Cloud')
  })

  it('opts out of snapshot-export with versionFormat: "unsupported"', () => {
    expect(hetznerPlugin.versionFormat).toBe('unsupported')
    // Restore methods are intentionally undefined per Doc D Decision 1.
    expect(hetznerPlugin.listVersions).toBeUndefined()
    expect(hetznerPlugin.planRestore).toBeUndefined()
    expect(hetznerPlugin.applyRestore).toBeUndefined()
  })

  it('nodeTypes contains all 5 Hetzner types', () => {
    for (const t of HETZNER_NODE_TYPES) {
      expect(hetznerPlugin.nodeTypes).toContain(t)
    }
    expect(hetznerPlugin.nodeTypes).toHaveLength(HETZNER_NODE_TYPES.length)
  })

  it('nodeTypeMetadata has an entry for every nodeType', () => {
    for (const t of hetznerPlugin.nodeTypes as string[]) {
      const meta = hetznerPlugin.nodeTypeMetadata[t]
      expect(meta, `missing metadata for ${t}`).toBeDefined()
      expect(typeof meta.label).toBe('string')
      expect(typeof meta.borderColor).toBe('string')
      expect(typeof meta.badgeColor).toBe('string')
      expect(typeof meta.shortLabel).toBe('string')
      expect(typeof meta.displayName).toBe('string')
      expect(typeof meta.hasCreate).toBe('boolean')
    }
  })

  it('createCredentials reads HETZNER_API_TOKEN and returns it', () => {
    const result = hetznerPlugin.createCredentials('default', 'eu-central')
    expect(result).toEqual({ token: 'fake-test-token-not-real' })
  })

  it('createCredentials throws when HETZNER_API_TOKEN is missing', () => {
    delete process.env.HETZNER_API_TOKEN
    expect(() => hetznerPlugin.createCredentials('default', 'eu-central')).toThrow(
      /HETZNER_API_TOKEN/
    )
  })

  it('scan() returns merged nodes from all five service scanners', async () => {
    const { scanServers } = await import('../../hetzner/services/server')
    const mockNode = {
      id: 'hcloud-server-1',
      type: 'hetzner:server',
      label: 'web-1',
      status: 'running',
      region: 'fsn1',
      metadata: {}
    }
    vi.mocked(scanServers).mockResolvedValueOnce([mockNode] as never)

    const result = await hetznerPlugin.scan({
      credentials: { token: 'fake-test-token-not-real' },
      region: 'eu-central'
    })

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('hcloud-server-1')
    expect(result.errors).toEqual([])
  })

  it('scan() collects errors from failing services without dropping healthy results', async () => {
    const { scanServers } = await import('../../hetzner/services/server')
    const { scanFirewalls } = await import('../../hetzner/services/firewall')
    const mockNode = {
      id: 'hcloud-server-2',
      type: 'hetzner:server',
      label: 'web-2',
      status: 'running',
      region: 'fsn1',
      metadata: {}
    }
    vi.mocked(scanServers).mockResolvedValueOnce([mockNode] as never)
    vi.mocked(scanFirewalls).mockRejectedValueOnce(new Error('hetzner: GET /firewalls → HTTP 403'))

    const result = await hetznerPlugin.scan({
      credentials: { token: 'fake-test-token-not-real' },
      region: 'eu-central'
    })

    expect(result.nodes).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].service).toBe('hetzner:firewall')
    expect(result.errors[0].message).toMatch(/HTTP 403/)
  })

  it('every nodeType matches the namespaced regex', () => {
    const NAMESPACED = /^[a-z]+:[a-z0-9-]+$/
    for (const t of hetznerPlugin.nodeTypes as string[]) {
      expect(NAMESPACED.test(t), `${t} fails namespace pattern`).toBe(true)
    }
  })
})
