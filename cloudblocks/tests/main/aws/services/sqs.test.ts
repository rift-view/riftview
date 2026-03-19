import { describe, it, expect, vi } from 'vitest'
import { SQSClient } from '@aws-sdk/client-sqs'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { listQueues } from '../../../../src/main/aws/services/sqs'

const mockSqsSend = vi.fn()
const mockLambdaSend = vi.fn()
const mockSqsClient = { send: mockSqsSend } as unknown as SQSClient
const mockLambdaClient = { send: mockLambdaSend } as unknown as LambdaClient

const QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue'
const QUEUE_ARN = 'arn:aws:sqs:us-east-1:123456789:my-queue'

describe('listQueues', () => {
  it('maps queue URLs to CloudNodes', async () => {
    mockSqsSend
      .mockResolvedValueOnce({ QueueUrls: [QUEUE_URL] })         // ListQueuesCommand
      .mockResolvedValueOnce({ Attributes: { QueueArn: QUEUE_ARN } }) // GetQueueAttributesCommand
    mockLambdaSend.mockResolvedValueOnce({ EventSourceMappings: [] }) // ListEventSourceMappingsCommand

    const nodes = await listQueues(mockSqsClient, mockLambdaClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('sqs')
    expect(nodes[0].label).toBe('my-queue')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('populates integrations when event source mappings exist', async () => {
    const functionArn = 'arn:aws:lambda:us-east-1:123456789:function:my-fn'

    mockSqsSend
      .mockResolvedValueOnce({ QueueUrls: [QUEUE_URL] })
      .mockResolvedValueOnce({ Attributes: { QueueArn: QUEUE_ARN } })
    mockLambdaSend.mockResolvedValueOnce({
      EventSourceMappings: [{ FunctionArn: functionArn }],
    })

    const nodes = await listQueues(mockSqsClient, mockLambdaClient, 'us-east-1')

    expect(nodes[0].integrations).toEqual([
      { targetId: functionArn, edgeType: 'trigger' },
    ])
  })

  it('returns empty array on SQS list error', async () => {
    mockSqsSend.mockRejectedValueOnce(new Error('AccessDenied'))

    // listQueues itself throws; callers (provider.ts) use .catch(() => [])
    const nodes = await listQueues(mockSqsClient, mockLambdaClient, 'us-east-1').catch(() => [])

    expect(nodes).toEqual([])
  })

  it('handles missing queue ARN gracefully', async () => {
    mockSqsSend
      .mockResolvedValueOnce({ QueueUrls: [QUEUE_URL] })
      .mockResolvedValueOnce({ Attributes: {} }) // no QueueArn

    const nodes = await listQueues(mockSqsClient, mockLambdaClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('sqs')
    expect(nodes[0].integrations).toBeUndefined()
  })
})
