import { Route53Client, ListHostedZonesCommand, ListResourceRecordSetsCommand } from '@aws-sdk/client-route-53'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

export async function listHostedZones(client: Route53Client): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListHostedZonesCommand({}))
    const zones = res.HostedZones ?? []

    return Promise.all(zones.map(async (item): Promise<CloudNode> => {
      const base: CloudNode = {
        id:       item.Id ?? '',
        type:     'r53-zone',
        label:    item.Name ?? '',
        status:   'running',
        region:   'global',
        metadata: { private: item.Config?.PrivateZone ?? false, recordCount: item.ResourceRecordSetCount ?? 0 },
      }

      try {
        const rrsRes = await client.send(new ListResourceRecordSetsCommand({ HostedZoneId: item.Id }))
        const integrations: { targetId: string; edgeType: EdgeType }[] = []
        for (const rrs of rrsRes.ResourceRecordSets ?? []) {
          const dnsName = rrs.AliasTarget?.DNSName
          if (dnsName) {
            // Trim trailing dot (Route53 returns canonical FQDN)
            integrations.push({ targetId: dnsName.replace(/\.$/, ''), edgeType: 'origin' })
          }
        }
        if (integrations.length > 0) return { ...base, integrations }
      } catch { /* ignore */ }

      return base
    }))
  } catch {
    return []
  }
}
