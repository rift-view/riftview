import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { listFunctions } from '../../../../src/main/aws/services/lambda'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as LambdaClient

describe('listFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps Lambda functions to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'my-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:my-fn',
          State: 'Active',
          VpcConfig: { VpcId: 'vpc-0abc' },
        }],
      })
      .mockResolvedValueOnce({ EventSourceMappings: [] })
      .mockResolvedValueOnce({ Environment: { Variables: {} } })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].id).toBe('arn:aws:lambda:us-east-1:123:function:my-fn')
    expect(nodes[0].type).toBe('lambda')
    expect(nodes[0].label).toBe('my-fn')
    expect(nodes[0].status).toBe('running')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('err'))
    expect(await listFunctions(mockClient, 'us-east-1')).toEqual([])
  })

  it('populates integrations when event source mappings return SQS ARNs', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'worker-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:worker-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({
        EventSourceMappings: [
          { EventSourceArn: 'arn:aws:sqs:us-east-1:123:my-queue' },
          { EventSourceArn: 'arn:aws:dynamodb:us-east-1:123:table/my-table/stream/2024-01-01' },
        ],
      })
      .mockResolvedValueOnce({ Environment: { Variables: {} } })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({
      targetId: 'arn:aws:sqs:us-east-1:123:my-queue',
      edgeType: 'trigger',
    })
  })

  it('leaves integrations undefined when event source mappings fetch fails', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'my-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:my-fn',
          State: 'Active',
        }],
      })
      .mockRejectedValueOnce(new Error('permissions denied'))
      .mockResolvedValueOnce({ Environment: { Variables: {} } })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('adds integration with extracted table name from DynamoDB ARN in env vars', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'ddb-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:ddb-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({ EventSourceMappings: [] })
      .mockResolvedValueOnce({
        Environment: {
          Variables: {
            TABLE_ARN: 'arn:aws:dynamodb:us-east-1:123456789:table/MyTable',
            UNRELATED: 'not-an-arn',
          },
        },
      })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({ targetId: 'MyTable', edgeType: 'trigger' })
  })

  it('adds integration from SNS topic ARN in env vars', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'sns-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:sns-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({ EventSourceMappings: [] })
      .mockResolvedValueOnce({
        Environment: {
          Variables: {
            TOPIC_ARN: 'arn:aws:sns:us-east-1:123456789:my-topic',
          },
        },
      })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({
      targetId: 'arn:aws:sns:us-east-1:123456789:my-topic',
      edgeType: 'trigger',
    })
  })

  it('adds integration from Secrets Manager ARN in env vars', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'secret-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:secret-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({ EventSourceMappings: [] })
      .mockResolvedValueOnce({
        Environment: {
          Variables: {
            SECRET_ARN: 'arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret-AbCd',
          },
        },
      })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0]).toEqual({
      targetId: 'arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret-AbCd',
      edgeType: 'trigger',
    })
  })

  it('deduplicates env var SQS ARN already present from event source mapping', async () => {
    const sqsArn = 'arn:aws:sqs:us-east-1:123:my-queue'
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'dedup-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:dedup-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({
        EventSourceMappings: [{ EventSourceArn: sqsArn }],
      })
      .mockResolvedValueOnce({
        Environment: {
          Variables: {
            QUEUE_URL: sqsArn,
          },
        },
      })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toHaveLength(1)
    expect(nodes[0].integrations?.[0].targetId).toBe(sqsArn)
  })

  it('ignores env vars that are plain strings with no recognisable pattern', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'plain-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:plain-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({ EventSourceMappings: [] })
      .mockResolvedValueOnce({
        Environment: {
          Variables: {
            STAGE: 'production',
            LOG_LEVEL: 'info',
            PORT: '8080',
          },
        },
      })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('adds integration from RDS hostname in env vars', async () => {
    mockSend
      .mockResolvedValueOnce({
        Functions: [{
          FunctionName: 'db-fn',
          FunctionArn: 'arn:aws:lambda:us-east-1:123:function:db-fn',
          State: 'Active',
        }],
      })
      .mockResolvedValueOnce({ EventSourceMappings: [] })
      .mockResolvedValueOnce({
        Environment: {
          Variables: {
            DB_HOST: 'my-db.cluster.us-east-1.rds.amazonaws.com',
          },
        },
      })
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes[0].integrations).toEqual([
      { targetId: 'my-db.cluster.us-east-1.rds.amazonaws.com', edgeType: 'trigger' },
    ])
  })
})
