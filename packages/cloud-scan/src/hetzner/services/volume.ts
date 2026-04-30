import type { CloudNode, NodeStatus } from '@riftview/shared'
import type { HetznerClient } from '../client'

interface HetznerVolume {
  id: number
  name: string
  status: string
  size: number
  server: number | null
  location?: { name?: string }
  format?: string | null
  linux_device?: string
  protection?: { delete?: boolean }
  labels?: Record<string, string>
}

function statusFor(status: string): NodeStatus {
  switch (status) {
    case 'available':
      return 'running'
    case 'creating':
      return 'creating'
    default:
      return 'unknown'
  }
}

/**
 * Scan Hetzner Cloud volumes. A volume is attached to at most one server;
 * the server scanner emits the volume → server edge, so this scanner only
 * surfaces volume nodes (with the attached-server id stashed in metadata
 * for the inspector).
 */
export async function scanVolumes(client: HetznerClient, region: string): Promise<CloudNode[]> {
  const volumes = await client.list<HetznerVolume>('/volumes', 'volumes')

  return volumes.map(
    (v): CloudNode => ({
      id: `hcloud-volume-${v.id}`,
      type: 'hetzner:volume',
      label: v.name,
      status: statusFor(v.status),
      region: v.location?.name ?? region,
      metadata: {
        hetznerId: v.id,
        sizeGb: v.size,
        format: v.format,
        linuxDevice: v.linux_device,
        attachedServer: v.server === null ? null : `hcloud-server-${v.server}`,
        deleteProtection: v.protection?.delete ?? false,
        labels: v.labels ?? {}
      }
    })
  )
}
