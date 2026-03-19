import { SNSClient, ListTopicsCommand } from '@aws-sdk/client-sns'
import type { CloudNode } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listTopics(client: SNSClient, region: string): Promise<CloudNode[]> {
  return scanFlatService<SNSClient, { TopicArn?: string }>(client, region, {
    fetch: async (c) => {
      const res = await c.send(new ListTopicsCommand({}))
      return res.Topics ?? []
    },
    map: (item, region): CloudNode => ({
      id:       item.TopicArn ?? '',
      type:     'sns',
      label:    item.TopicArn?.split(':').pop() ?? '',
      status:   'running',
      region,
      metadata: {},
    }),
  })
}
