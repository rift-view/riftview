import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider'
import { listUserPools } from '../../../../src/main/aws/services/cognito'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as CognitoIdentityProviderClient

const POOL_ID   = 'us-east-1_abcDEF123'
const POOL_ID_2 = 'us-east-1_xyz789'
const LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789012:function:my-trigger'

describe('listUserPools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a user pool to a CloudNode', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }], NextToken: undefined })  // ListUserPools
      .mockResolvedValueOnce({ UserPool: { Id: POOL_ID, Name: 'MyPool' } })           // DescribeUserPool

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('cognito')
    expect(nodes[0].id).toBe(POOL_ID)
    expect(nodes[0].label).toBe('MyPool')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('uses poolId as label when Name is missing', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }] })
      .mockResolvedValueOnce({ UserPool: { Id: POOL_ID, Name: undefined } })

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes[0].label).toBe(POOL_ID)
  })

  it('stores poolId in metadata', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }] })
      .mockResolvedValueOnce({ UserPool: { Id: POOL_ID, Name: 'MyPool' } })

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes[0].metadata.poolId).toBe(POOL_ID)
  })

  it('extracts lambda trigger integrations from LambdaConfig', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }] })
      .mockResolvedValueOnce({
        UserPool: {
          Id: POOL_ID,
          Name: 'MyPool',
          LambdaConfig: {
            PreSignUp:         LAMBDA_ARN,
            PostConfirmation:  'arn:aws:lambda:us-east-1:123456789012:function:post-confirm',
          },
        },
      })

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toHaveLength(2)
    expect(nodes[0].integrations?.every(i => i.edgeType === 'trigger')).toBe(true)
    expect(nodes[0].integrations?.map(i => i.targetId)).toContain(LAMBDA_ARN)
  })

  it('omits integrations field when LambdaConfig is empty', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }] })
      .mockResolvedValueOnce({ UserPool: { Id: POOL_ID, Name: 'MyPool', LambdaConfig: {} } })

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('paginates across multiple pages', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }],   NextToken: 'tok1' }) // page 1
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID_2 }], NextToken: undefined }) // page 2
      .mockResolvedValueOnce({ UserPool: { Id: POOL_ID,   Name: 'Pool1' } })
      .mockResolvedValueOnce({ UserPool: { Id: POOL_ID_2, Name: 'Pool2' } })

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id).sort()).toEqual([POOL_ID, POOL_ID_2].sort())
  })

  it('falls back to base node when DescribeUserPool fails', async () => {
    mockSend
      .mockResolvedValueOnce({ UserPools: [{ Id: POOL_ID }] })
      .mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(POOL_ID)
    expect(nodes[0].label).toBe(POOL_ID)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns empty array on top-level ListUserPools error', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    const nodes = await listUserPools(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
