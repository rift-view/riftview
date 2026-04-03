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
    const nodes = await listFunctions(mockClient, 'us-east-1')
    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })
})
