import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SSMClient } from '@aws-sdk/client-ssm'
import { listParameters } from '../../../../src/main/aws/services/ssm'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as SSMClient

const PARAM_ARN  = 'arn:aws:ssm:us-east-1:123456789012:parameter/my-param'
const PARAM_ARN2 = 'arn:aws:ssm:us-east-1:123456789012:parameter/my-param-2'

describe('listParameters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a parameter to a CloudNode', async () => {
    mockSend.mockResolvedValueOnce({
      Parameters: [{
        ARN:  PARAM_ARN,
        Name: '/my-param',
        Type: 'String',
        Tier: 'Standard',
      }],
    })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('ssm-param')
    expect(nodes[0].id).toBe(PARAM_ARN)
    expect(nodes[0].label).toBe('/my-param')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores type and tier in metadata', async () => {
    mockSend.mockResolvedValueOnce({
      Parameters: [{
        ARN:  PARAM_ARN,
        Name: '/my-param',
        Type: 'SecureString',
        Tier: 'Advanced',
      }],
    })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes[0].metadata.type).toBe('SecureString')
    expect(nodes[0].metadata.tier).toBe('Advanced')
  })

  it('uses Name as id when ARN is missing', async () => {
    mockSend.mockResolvedValueOnce({
      Parameters: [{
        ARN:  undefined,
        Name: '/my-param',
        Type: 'String',
        Tier: 'Standard',
      }],
    })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes[0].id).toBe('/my-param')
  })

  it('falls back to empty string id when both ARN and Name are missing', async () => {
    mockSend.mockResolvedValueOnce({
      Parameters: [{ ARN: undefined, Name: undefined, Type: 'String', Tier: 'Standard' }],
    })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes[0].id).toBe('')
    expect(nodes[0].label).toBe('')
  })

  it('defaults type and tier to empty string when absent', async () => {
    mockSend.mockResolvedValueOnce({
      Parameters: [{ ARN: PARAM_ARN, Name: '/my-param', Type: undefined, Tier: undefined }],
    })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes[0].metadata.type).toBe('')
    expect(nodes[0].metadata.tier).toBe('')
  })

  it('paginates across multiple pages', async () => {
    mockSend
      .mockResolvedValueOnce({
        Parameters: [{ ARN: PARAM_ARN,  Name: '/p1', Type: 'String', Tier: 'Standard' }],
        NextToken: 'tok1',
      })
      .mockResolvedValueOnce({
        Parameters: [{ ARN: PARAM_ARN2, Name: '/p2', Type: 'String', Tier: 'Standard' }],
        NextToken: undefined,
      })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id).sort()).toEqual([PARAM_ARN, PARAM_ARN2].sort())
  })

  it('returns empty array when no parameters exist', async () => {
    mockSend.mockResolvedValueOnce({ Parameters: [] })

    const nodes = await listParameters(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })

  it('propagates error thrown by DescribeParametersCommand', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))

    await expect(listParameters(mockClient, 'us-east-1')).rejects.toThrow('AccessDenied')
  })
})
