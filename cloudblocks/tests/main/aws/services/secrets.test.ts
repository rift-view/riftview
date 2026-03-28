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

  it('maps secrets to CloudNodes', async () => {
    mockSend
      .mockResolvedValueOnce({ SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret' }] }) // ListSecretsCommand
      .mockResolvedValueOnce({ ARN: SECRET_ARN, Name: 'my-secret' }) // DescribeSecretCommand

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(SECRET_ARN)
    expect(nodes[0].type).toBe('secret')
    expect(nodes[0].label).toBe('my-secret')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('attaches rotation Lambda as trigger integration', async () => {
    mockSend
      .mockResolvedValueOnce({ SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret' }] })
      .mockResolvedValueOnce({ ARN: SECRET_ARN, RotationLambdaARN: ROTATION_LAMBDA_ARN })

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toEqual([
      { targetId: ROTATION_LAMBDA_ARN, edgeType: 'trigger' },
    ])
  })

  it('returns node without integrations when no rotation Lambda is configured', async () => {
    mockSend
      .mockResolvedValueOnce({ SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret' }] })
      .mockResolvedValueOnce({ ARN: SECRET_ARN }) // no RotationLambdaARN

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes[0].integrations).toBeUndefined()
  })

  it('silently ignores DescribeSecret errors per secret', async () => {
    mockSend
      .mockResolvedValueOnce({ SecretList: [{ ARN: SECRET_ARN, Name: 'my-secret' }] })
      .mockRejectedValueOnce(new Error('ResourceNotFoundException'))

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].integrations).toBeUndefined()
  })

  it('returns empty array on ListSecrets failure', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listSecrets(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
