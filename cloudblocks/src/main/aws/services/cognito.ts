import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listUserPools(client: CognitoIdentityProviderClient, region: string): Promise<CloudNode[]> {
  try {
    const nodes: CloudNode[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken }))
      for (const pool of res.UserPools ?? []) {
        if (!pool.Id) continue
        nodes.push({
          id:       pool.Id,
          type:     'cognito',
          label:    pool.Name ?? pool.Id,
          status:   'running',
          region,
          metadata: { poolId: pool.Id },
        })
      }
      nextToken = res.NextToken
    } while (nextToken)
    return nodes
  } catch {
    return []
  }
}
