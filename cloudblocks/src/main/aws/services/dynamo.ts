import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import type { CloudNode } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listTables(client: DynamoDBClient, region: string): Promise<CloudNode[]> {
  return scanFlatService<DynamoDBClient, string>(client, region, {
    fetch: async (c) => {
      const res = await c.send(new ListTablesCommand({}))
      return res.TableNames ?? []
    },
    map: (name, region): CloudNode => ({
      id:       name,
      type:     'dynamo',
      label:    name,
      status:   'running',
      region,
      metadata: {},
    }),
  })
}
