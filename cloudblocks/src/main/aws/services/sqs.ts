import { SQSClient, ListQueuesCommand } from '@aws-sdk/client-sqs'
import type { CloudNode } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listQueues(client: SQSClient, region: string): Promise<CloudNode[]> {
  return scanFlatService(client, region, {
    fetch: async (c) => {
      const res = await c.send(new ListQueuesCommand({}))
      return res.QueueUrls ?? []
    },
    map: (url, region): CloudNode => ({
      id:       url,
      type:     'sqs',
      label:    url.split('/').pop() ?? url,
      status:   'running',
      region,
      metadata: {},
    }),
  })
}
