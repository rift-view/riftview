import { SecretsManagerClient, ListSecretsCommand } from '@aws-sdk/client-secrets-manager'
import type { CloudNode } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listSecrets(client: SecretsManagerClient, region: string): Promise<CloudNode[]> {
  return scanFlatService(client, region, {
    fetch: async (c) => {
      const res = await c.send(new ListSecretsCommand({}))
      return res.SecretList ?? []
    },
    map: (item, region): CloudNode => ({
      id:       item.ARN ?? '',
      type:     'secret',
      label:    item.Name ?? item.ARN ?? '',
      status:   'running',
      region,
      metadata: {
        description:  item.Description ?? '',
        lastRotated:  item.LastRotatedDate?.toISOString() ?? '',
      },
    }),
  })
}
