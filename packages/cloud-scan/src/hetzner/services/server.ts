import type { CloudNode, NodeStatus } from '@riftview/shared'
import type { HetznerClient } from '../client'

interface HetznerServer {
  id: number
  name: string
  status: string
  datacenter?: { location?: { name?: string } }
  server_type?: { name?: string }
  image?: { name?: string; description?: string }
  public_net?: {
    ipv4?: { ip?: string } | null
    ipv6?: { ip?: string } | null
  }
  private_net?: { network: number; ip?: string }[]
  volumes?: number[]
  load_balancers?: number[]
  primary_disk_size?: number
  labels?: Record<string, string>
}

/**
 * Map Hetzner server `status` to the cross-cloud `NodeStatus` enum.
 * Hetzner statuses: `running`, `initializing`, `starting`, `stopping`,
 * `off`, `deleting`, `migrating`, `rebuilding`, `unknown`.
 */
function statusFor(status: string): NodeStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'off':
      return 'stopped'
    case 'starting':
    case 'initializing':
    case 'rebuilding':
    case 'migrating':
      return 'pending'
    case 'stopping':
    case 'deleting':
      return 'deleting'
    default:
      return 'unknown'
  }
}

/**
 * Scan Hetzner Cloud servers and emit `hetzner:server` nodes.
 *
 * Edges (recorded under `metadata` for downstream edge-resolution; the
 * graph layer turns these into actual `CloudEdge`s by resolving target
 * ids on the renderer side):
 *   - private_net  → hetzner:network
 *   - volumes      → hetzner:volume
 *   - firewalls    → hetzner:firewall  (per-server attached, NOT subnet-scoped)
 */
export async function scanServers(client: HetznerClient, region: string): Promise<CloudNode[]> {
  // Hetzner servers expose attached firewalls under `public_net.firewalls`
  // when querying `/servers`. The shape isn't exposed cleanly in the
  // openapi spec so we read it through a permissive `Record<string, unknown>`.
  type ServerWithFirewalls = HetznerServer & {
    public_net?: HetznerServer['public_net'] & {
      firewalls?: { id: number; status?: string }[]
    }
  }

  const servers = await client.list<ServerWithFirewalls>('/servers', 'servers')

  return servers.map((s): CloudNode => {
    const location = s.datacenter?.location?.name ?? region
    const privateNets = s.private_net ?? []
    const volumes = s.volumes ?? []
    const firewalls = s.public_net?.firewalls ?? []

    return {
      id: `hcloud-server-${s.id}`,
      type: 'hetzner:server',
      label: s.name,
      status: statusFor(s.status),
      region: location,
      metadata: {
        hetznerId: s.id,
        serverType: s.server_type?.name,
        image: s.image?.name ?? s.image?.description,
        publicIp: s.public_net?.ipv4?.ip,
        publicIpv6: s.public_net?.ipv6?.ip,
        primaryDiskSize: s.primary_disk_size,
        attachedNetworks: privateNets.map((n) => `hcloud-network-${n.network}`),
        attachedVolumes: volumes.map((v) => `hcloud-volume-${v}`),
        attachedFirewalls: firewalls.map((f) => `hcloud-firewall-${f.id}`),
        labels: s.labels ?? {}
      },
      integrations: [
        ...privateNets.map((n) => ({
          targetId: `hcloud-network-${n.network}`,
          edgeType: 'origin' as const
        })),
        ...volumes.map((v) => ({
          targetId: `hcloud-volume-${v}`,
          edgeType: 'origin' as const
        })),
        ...firewalls.map((f) => ({
          targetId: `hcloud-firewall-${f.id}`,
          edgeType: 'origin' as const
        }))
      ]
    }
  })
}
