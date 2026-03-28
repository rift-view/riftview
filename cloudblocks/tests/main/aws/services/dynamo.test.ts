import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { listTables } from '../../../../src/main/aws/services/dynamo'

const mockDynamoSend = vi.fn()
const mockLambdaSend = vi.fn()
const mockDynamoClient = { send: mockDynamoSend } as unknown as DynamoDBClient
const mockLambdaClient = { send: mockLambdaSend } as unknown as LambdaClient

const TABLE_NAME = 'my-table'
const STREAM_ARN = 'arn:aws:dynamodb:us-east-1:123456789:table/my-table/stream/2024-01-01T00:00:00.000'
const FUNCTION_ARN = 'arn:aws:lambda:us-east-1:123456789:function:my-fn'

describe('listTables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps DynamoDB tables to CloudNodes', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ TableNames: [TABLE_NAME] }) // ListTablesCommand
      .mockResolvedValueOnce({ Table: { TableName: TABLE_NAME } }) // DescribeTableCommand — no stream

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(TABLE_NAME)
    expect(nodes[0].type).toBe('dynamo')
    expect(nodes[0].label).toBe(TABLE_NAME)
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('produces integrations when DynamoDB stream → Lambda ESM exists', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ TableNames: [TABLE_NAME] })
      .mockResolvedValueOnce({ Table: { TableName: TABLE_NAME, LatestStreamArn: STREAM_ARN } })
    mockLambdaSend.mockResolvedValueOnce({
      EventSourceMappings: [{ FunctionArn: FUNCTION_ARN }],
    })

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes[0].integrations).toEqual([{ targetId: FUNCTION_ARN, edgeType: 'trigger' }])
  })

  it('returns node without integrations when table has no stream', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ TableNames: [TABLE_NAME] })
      .mockResolvedValueOnce({ Table: { TableName: TABLE_NAME } }) // no LatestStreamArn

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns node without integrations when ESM has no function ARNs', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ TableNames: [TABLE_NAME] })
      .mockResolvedValueOnce({ Table: { TableName: TABLE_NAME, LatestStreamArn: STREAM_ARN } })
    mockLambdaSend.mockResolvedValueOnce({ EventSourceMappings: [] })

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('handles DescribeTable failure gracefully', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ TableNames: [TABLE_NAME] })
      .mockRejectedValueOnce(new Error('ResourceNotFoundException'))

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('handles ListEventSourceMappings failure gracefully', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({ TableNames: [TABLE_NAME] })
      .mockResolvedValueOnce({ Table: { TableName: TABLE_NAME, LatestStreamArn: STREAM_ARN } })
    mockLambdaSend.mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns empty array on ListTables failure', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listTables(mockDynamoClient, mockLambdaClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
