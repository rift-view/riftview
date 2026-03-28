import {
  SecretsManagerClient,
  ListSecretsCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

export async function listSecrets(client: SecretsManagerClient, region: string): Promise<CloudNode[]> {
  let secretList: { ARN?: string; Name?: string; Description?: string; LastRotatedDate?: Date }[] = []
  try {
    const res = await client.send(new ListSecretsCommand({}))
    secretList = res.SecretList ?? []
  } catch {
    return []
  }

  const nodes = await Promise.all(
    secretList.map(async (item): Promise<CloudNode> => {
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

      const descRes = await client
        .send(new DescribeSecretCommand({ SecretId: item.ARN ?? item.Name }))
        .catch(() => null)

      const rotationArn = descRes?.RotationLambdaARN
      if (!rotationArn) return baseNode

      const integrations: { targetId: string; edgeType: EdgeType }[] = [
        { targetId: rotationArn, edgeType: 'trigger' },
      ]

      return integrations.length > 0 ? { ...baseNode, integrations } : baseNode
    })
  )

  return nodes
}
