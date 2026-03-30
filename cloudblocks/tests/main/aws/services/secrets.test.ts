import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager'
import { listSecrets } from '../../../../src/main/aws/services/secrets'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as SecretsManagerClient

const SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789:secret:my-secret-AbCdEf'
const ROTATION_LAMBDA_ARN = 'arn:aws:lambda:us-east-1:123456789:function:my-rotation-fn'

describe('listSecrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps secrets to CloudNodes with a single ListSecrets call', async () => {
    mockSend.mockResolvedValueOnce({ SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret' }] })

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(SECRET_ARN)
    expect(nodes[0].type).toBe('secret')
    expect(nodes[0].label).toBe('my-secret')
    expect(nodes[0].region).toBe('us-east-1')
    // Only one API call total — no per-secret DescribeSecret calls
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('attaches rotation Lambda as trigger integration from ListSecrets response', async () => {
    mockSend.mockResolvedValueOnce({
      SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret', RotationLambdaARN: ROTATION_LAMBDA_ARN }],
    })

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toEqual([
      { targetId: ROTATION_LAMBDA_ARN, edgeType: 'trigger' },
    ])
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('returns node without integrations when no rotation Lambda is configured', async () => {
    mockSend.mockResolvedValueOnce({
      SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret' }],
    })

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('handles multiple secrets including mixed rotation/no-rotation', async () => {
    const ARN2 = 'arn:aws:secretsmanager:us-east-1:123456789:secret:other-secret-XyZwVu'
    mockSend.mockResolvedValueOnce({
      SecretList: [
        { ARN: SECRET_ARN, Name: 'my-secret', RotationLambdaARN: ROTATION_LAMBDA_ARN },
        { ARN: ARN2, Name: 'other-secret' },
      ],
    })

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes[0].integrations).toEqual([{ targetId: ROTATION_LAMBDA_ARN, edgeType: 'trigger' }])
    expect(nodes[1].integrations).toBeUndefined()
    // Still only one API call regardless of secret count
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('returns empty array on ListSecrets failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
