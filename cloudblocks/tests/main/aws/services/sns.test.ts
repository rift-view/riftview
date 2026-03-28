import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SNSClient } from '@aws-sdk/client-sns'
import { listTopics } from '../../../../src/main/aws/services/sns'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as SNSClient

describe('listTopics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps SNS topics to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({ Topics: [{ TopicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' }] })
      .mockResolvedValueOnce({ Subscriptions: [] })

    const nodes = await listTopics(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('sns')
    expect(nodes[0].label).toBe('my-topic')
    expect(nodes[0].id).toBe('arn:aws:sns:us-east-1:123456789:my-topic')
  })

  it('populates integrations for ARN subscription endpoints only', async () => {
    mockSend
      .mockResolvedValueOnce({ Topics: [{ TopicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' }] })
      .mockResolvedValueOnce({
        Subscriptions: [
          { Endpoint: 'arn:aws:lambda:us-east-1:123456789:function:my-fn', Protocol: 'lambda' },
          { Endpoint: 'https://example.com/webhook', Protocol: 'https' },
          { Endpoint: 'arn:aws:sqs:us-east-1:123456789:my-queue', Protocol: 'sqs' },
        ],
      })

    const nodes = await listTopics(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(2)
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'subscription')).toBe(true)
    expect(nodes[0].integrations?.map((i) => i.targetId)).toEqual([
      'arn:aws:lambda:us-east-1:123456789:function:my-fn',
      'arn:aws:sqs:us-east-1:123456789:my-queue',
    ])
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    await expect(listTopics(mockClient, 'us-east-1')).rejects.toThrow('network error')
  })

  it('handles subscription fetch error per-topic gracefully', async () => {
    mockSend
      .mockResolvedValueOnce({ Topics: [{ TopicArn: 'arn:aws:sns:us-east-1:123456789:my-topic' }] })
      .mockRejectedValueOnce(new Error('subscriptions unavailable'))

    const nodes = await listTopics(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('arn:aws:sns:us-east-1:123456789:my-topic')
    expect(nodes[0].integrations).toBeUndefined()
  })
})
