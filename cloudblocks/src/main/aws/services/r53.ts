import { Route53Client, ListHostedZonesCommand } from '@aws-sdk/client-route-53'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listHostedZones(client: Route53Client): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListHostedZonesCommand({}))
    return (res.HostedZones ?? []).map((item): CloudNode => ({
      id:       item.Id ?? '',
      type:     'r53-zone',
      label:    item.Name ?? '',
      status:   'running',
      region:   'global',
      metadata: { private: item.Config?.PrivateZone ?? false, recordCount: item.ResourceRecordSetCount ?? 0 },
    }))
  } catch {
    return []
  }
}
