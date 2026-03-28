import { describe, it, expect, vi, beforeEach } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'
import { listBuckets } from '../../../../src/main/aws/services/s3'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as S3Client

const LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789:function:my-fn'
const SQS_ARN = 'arn:aws:sqs:us-east-1:123456789:my-queue'
const SNS_ARN = 'arn:aws:sns:us-east-1:123456789:my-topic'

describe('listBuckets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps S3 buckets to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] }) // ListBucketsCommand
      .mockResolvedValueOnce({}) // GetBucketNotificationConfigurationCommand — empty

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes[0].id).toBe('my-bucket')
    expect(nodes[0].type).toBe('s3')
    expect(nodes[0].status).toBe('running')
  })

  it('returns empty array on ListBuckets error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))
    expect(await listBuckets(mockClient, 'us-east-1')).toEqual([])
  })

  it('attaches Lambda trigger integrations from LambdaFunctionConfigurations', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
      .mockResolvedValueOnce({
        LambdaFunctionConfigurations: [{ LambdaFunctionArn: LAMBDA_ARN }],
      })

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: LAMBDA_ARN, edgeType: 'trigger' })
  })

  it('attaches SQS trigger integrations from QueueConfigurations', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
      .mockResolvedValueOnce({
        QueueConfigurations: [{ QueueArn: SQS_ARN }],
      })

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: SQS_ARN, edgeType: 'trigger' })
  })

  it('attaches SNS trigger integrations from TopicConfigurations', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
      .mockResolvedValueOnce({
        TopicConfigurations: [{ TopicArn: SNS_ARN }],
      })

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: SNS_ARN, edgeType: 'trigger' })
  })

  it('collects integrations from all three notification config types', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
      .mockResolvedValueOnce({
        LambdaFunctionConfigurations: [{ LambdaFunctionArn: LAMBDA_ARN }],
        QueueConfigurations: [{ QueueArn: SQS_ARN }],
        TopicConfigurations: [{ TopicArn: SNS_ARN }],
      })

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(3)
    expect(nodes[0].integrations?.map((i) => i.targetId)).toEqual([LAMBDA_ARN, SQS_ARN, SNS_ARN])
    expect(nodes[0].integrations?.every((i) => i.edgeType === 'trigger')).toBe(true)
  })

  it('silently ignores GetBucketNotificationConfiguration errors', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
      .mockRejectedValueOnce(new Error('NoSuchBucketNotificationConfiguration'))

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns node without integrations when notification config is empty', async () => {
    mockSend
      .mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
      .mockResolvedValueOnce({})

    const nodes = await listBuckets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })
})
