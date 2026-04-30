import type { CloudNode } from '@riftview/shared'
import type { HetznerClient } from '../client'

interface HetznerNetwork {
  id: number
  name: string
  ip_range: string
  subnets?: { type: string; ip_range: string; network_zone: string; gateway?: string }[]
  routes?: { destination: string; gateway: string }[]
  servers?: number[]
  load_balancers?: number[]
  expose_routes_to_vswitch?: boolean
  labels?: Record<string, string>
}

/**
 * Scan Hetzner Cloud private networks. Hetzner networks are project-scoped
 * (no AZ concept) — `network_zone` (e.g. `eu-central`) is the closest
 * equivalent. Edges from network → server are produced by `scanServers`,
 * so we don't double-emit them here.
 */
export async function scanNetworks(client: HetznerClient, region: string): Promise<CloudNode[]> {
  const networks = await client.list<HetznerNetwork>('/networks', 'networks')

  return networks.map(
    (n): CloudNode => ({
      id: `hcloud-network-${n.id}`,
      type: 'hetzner:network',
      label: n.name,
      // Networks have no operational state — they exist or they don't.
      status: 'running',
      region: n.subnets?.[0]?.network_zone ?? region,
      metadata: {
        hetznerId: n.id,
        ipRange: n.ip_range,
        subnets: n.subnets ?? [],
        routes: n.routes ?? [],
        attachedServers: (n.servers ?? []).map((id) => `hcloud-server-${id}`),
        labels: n.labels ?? {}
      }
    })
  )
}
