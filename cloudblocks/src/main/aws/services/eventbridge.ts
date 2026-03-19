import { EventBridgeClient, ListEventBusesCommand } from '@aws-sdk/client-eventbridge'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listEventBuses(client: EventBridgeClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListEventBusesCommand({}))
    return (res.EventBuses ?? []).map((item): CloudNode => ({
      id:       item.Arn ?? '',
      type:     'eventbridge-bus',
      label:    item.Name ?? '',
      status:   'running',
      region,
      metadata: { policy: item.Policy ? 'custom' : 'default' },
    }))
  } catch {
    return []
  }
}
