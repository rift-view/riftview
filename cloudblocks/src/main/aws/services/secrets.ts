import {
  SecretsManagerClient,
  ListSecretsCommand,
} from '@aws-sdk/client-secrets-manager'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

export async function listSecrets(client: SecretsManagerClient, region: string): Promise<CloudNode[]> {
  let secretList: { ARN?: string; Name?: string; Description?: string; LastRotatedDate?: Date; RotationLambdaARN?: string }[] = []
  try {
    const res = await client.send(new ListSecretsCommand({}))
    secretList = res.SecretList ?? []
  } catch {
    return []
  }

  return secretList.map((item): CloudNode => {
    const baseNode: CloudNode = {
      id: item.ARN ?? '',
      type: 'secret',
      label: item.Name ?? item.ARN ?? '',
      status: 'running',
      region,
      metadata: {
        description: item.Description ?? '',
        lastRotated: item.LastRotatedDate?.toISOString() ?? '',
      },
    }

    if (!item.RotationLambdaARN) return baseNode

    const integrations: { targetId: string; edgeType: EdgeType }[] = [
      { targetId: item.RotationLambdaARN, edgeType: 'trigger' },
    ]
    return { ...baseNode, integrations }
  })
}
