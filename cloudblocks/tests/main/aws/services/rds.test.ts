import { describe, it, expect, vi } from 'vitest'
import { RDSClient } from '@aws-sdk/client-rds'
import { describeDBInstances } from '../../../../src/main/aws/services/rds'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as RDSClient

describe('describeDBInstances', () => {
  it('maps RDS instances to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({
      DBInstances: [{
        DBInstanceIdentifier: 'prod-db',
        DBInstanceStatus: 'available',
        Engine: 'mysql',
        DBSubnetGroup: { VpcId: 'vpc-0abc' },
      }],
    })
    const nodes = await describeDBInstances(mockClient, 'us-east-1')
    expect(nodes[0].id).toBe('prod-db')
    expect(nodes[0].type).toBe('rds')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].parentId).toBe('vpc-0abc')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))
    expect(await describeDBInstances(mockClient, 'us-east-1')).toEqual([])
  })
})
