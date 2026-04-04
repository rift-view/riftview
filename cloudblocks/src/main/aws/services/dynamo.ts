import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb'
import { LambdaClient, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

export async function listTables(
  client: DynamoDBClient,
  lambdaClient: LambdaClient,
  region: string,
): Promise<CloudNode[]> {
  let tableNames: string[] = []
  try {
    let exclusiveStartTableName: string | undefined
    do {
      const res = await client.send(new ListTablesCommand({ ExclusiveStartTableName: exclusiveStartTableName }))
      tableNames.push(...(res.TableNames ?? []))
      exclusiveStartTableName = res.LastEvaluatedTableName
    } while (exclusiveStartTableName)
  } catch {
    return []
  }

  const nodes = await Promise.all(
    tableNames.map(async (name): Promise<CloudNode> => {
      const baseNode: CloudNode = {
        id: name,
        type: 'dynamo',
        label: name,
        status: 'running',
        region,
        metadata: {},
      }

      const descRes = await client
        .send(new DescribeTableCommand({ TableName: name }))
        .catch(() => null)

      const streamArn = descRes?.Table?.LatestStreamArn
      if (!streamArn) return baseNode

      const mappingRes = await lambdaClient
        .send(new ListEventSourceMappingsCommand({ EventSourceArn: streamArn }))
        .catch(() => ({ EventSourceMappings: [] }))

      const integrations: { targetId: string; edgeType: EdgeType }[] = (
        mappingRes.EventSourceMappings ?? []
      )
        .filter((m): m is typeof m & { FunctionArn: string } => m.FunctionArn != null)
        .map((m) => ({ targetId: m.FunctionArn, edgeType: 'trigger' as EdgeType }))

      return integrations.length > 0 ? { ...baseNode, integrations } : baseNode
    })
  )

  return nodes
}
