import { SNSClient, ListTopicsCommand, ListSubscriptionsByTopicCommand } from '@aws-sdk/client-sns'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listTopics(client: SNSClient, region: string): Promise<CloudNode[]> {
  const nodes = await scanFlatService<SNSClient, { TopicArn?: string }>(client, region, {
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

  await Promise.all(
    nodes.map(async (node) => {
      const subs = await client
        .send(new ListSubscriptionsByTopicCommand({ TopicArn: node.id }))
        .catch(() => ({ Subscriptions: [] }))

      const integrations: { targetId: string; edgeType: EdgeType }[] = (subs.Subscriptions ?? [])
        .filter((s) => typeof s.Endpoint === 'string' && s.Endpoint.startsWith('arn:'))
        .map((s) => ({ targetId: s.Endpoint as string, edgeType: 'subscription' as EdgeType }))

      if (integrations.length > 0) {
        node.integrations = integrations
      }
    }),
  )

  return nodes
}
