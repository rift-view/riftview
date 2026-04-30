import type { CloudNode } from '@riftview/shared'
import type { HetznerClient } from '../client'

interface HetznerFirewallRule {
  direction: 'in' | 'out'
  protocol: string
  port?: string
  source_ips?: string[]
  destination_ips?: string[]
  description?: string
}

interface HetznerFirewallResource {
  type: string
  server?: { id: number }
  label_selector?: { selector: string }
}

interface HetznerFirewall {
  id: number
  name: string
  rules?: HetznerFirewallRule[]
  applied_to?: HetznerFirewallResource[]
  labels?: Record<string, string>
}

/**
 * Scan Hetzner Cloud firewalls. Hetzner firewalls attach directly to
 * servers (or label-selectors that match servers) — there is no
 * subnet/VPC-scoped firewall concept, so the integration edge is
 * `hetzner:server` ↔ `hetzner:firewall` and gets emitted by `scanServers`.
 *
 * We retain `appliedTo` here for the inspector + drift detection, but
 * we deliberately do NOT mirror AWS's security-group → VPC parent
 * relationship.
 */
export async function scanFirewalls(client: HetznerClient, region: string): Promise<CloudNode[]> {
  const firewalls = await client.list<HetznerFirewall>('/firewalls', 'firewalls')

  return firewalls.map((fw): CloudNode => {
    const appliedToServerIds = (fw.applied_to ?? [])
      .filter((r) => r.type === 'server' && r.server)
      .map((r) => `hcloud-server-${r.server!.id}`)
    const labelSelectors = (fw.applied_to ?? [])
      .filter((r) => r.type === 'label_selector')
      .map((r) => r.label_selector?.selector)
      .filter((sel): sel is string => Boolean(sel))

    return {
      id: `hcloud-firewall-${fw.id}`,
      type: 'hetzner:firewall',
      label: fw.name,
      status: 'running',
      region,
      metadata: {
        hetznerId: fw.id,
        rules: fw.rules ?? [],
        ruleCount: (fw.rules ?? []).length,
        appliedToServers: appliedToServerIds,
        labelSelectors,
        labels: fw.labels ?? {}
      }
    }
  })
}
