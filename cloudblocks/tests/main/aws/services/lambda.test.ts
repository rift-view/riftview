import { describe, it, expect, vi } from 'vitest'
import { LambdaClient } from '@aws-sdk/client-lambda'
import { listFunctions } from '../../../../src/main/aws/services/lambda'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as LambdaClient

describe('listFunctions', () => {
  it('maps Lambda functions to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      Functions: [{
        FunctionName: 'my-fn',
        FunctionArn: 'arn:aws:lambda:us-east-1:123:function:my-fn',
        State: 'Active',
        VpcConfig: { VpcId: 'vpc-0abc' },
      }],
    })
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
})
