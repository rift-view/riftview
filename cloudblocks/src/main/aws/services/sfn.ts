import { SFNClient, ListStateMachinesCommand } from '@aws-sdk/client-sfn'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listStateMachines(client: SFNClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListStateMachinesCommand({}))
    return (res.stateMachines ?? []).map((item): CloudNode => ({
      id:       item.stateMachineArn ?? '',
      type:     'sfn',
      label:    item.name ?? '',
      status:   'running',
      region,
      metadata: { type: item.type ?? '', createdAt: item.creationDate?.toISOString() ?? '' },
    }))
  } catch {
    return []
  }
}
