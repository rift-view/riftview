import {
  CognitoIdentityProviderClient,
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
  type LambdaConfigType,
} from '@aws-sdk/client-cognito-identity-provider'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

function extractLambdaTriggers(lambdaConfig: LambdaConfigType | undefined): { targetId: string; edgeType: EdgeType }[] {
  if (!lambdaConfig) return []
  return Object.values(lambdaConfig)
    .filter((v): v is string => typeof v === 'string' && v.startsWith('arn:aws:lambda:'))
    .map((arn) => ({ targetId: arn, edgeType: 'trigger' as EdgeType }))
}

export async function listUserPools(client: CognitoIdentityProviderClient, region: string): Promise<CloudNode[]> {
  try {
    const poolIds: string[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken }))
      for (const pool of res.UserPools ?? []) {
        if (pool.Id) poolIds.push(pool.Id)
      }
      nextToken = res.NextToken
    } while (nextToken)

    return Promise.all(poolIds.map(async (poolId): Promise<CloudNode> => {
      const base: CloudNode = {
        id:       poolId,
        type:     'cognito',
        label:    poolId,
        status:   'running',
        region,
        metadata: { poolId },
      }
      try {
        const desc = await client.send(new DescribeUserPoolCommand({ UserPoolId: poolId }))
        const pool = desc.UserPool
        if (!pool) return base
        const integrations = extractLambdaTriggers(pool.LambdaConfig)
        return {
          ...base,
          label: pool.Name ?? poolId,
          ...(integrations.length > 0 ? { integrations } : {}),
        }
      } catch {
        return base
      }
    }))
  } catch {
    return []
  }
}
