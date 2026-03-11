import { describe, it, expect, vi } from 'vitest'
import { S3Client } from '@aws-sdk/client-s3'
import { listBuckets } from '../../../../src/main/aws/services/s3'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as S3Client

describe('listBuckets', () => {
  it('maps S3 buckets to CloudNodes', async () => {
    mockSend.mockResolvedValueOnce({ Buckets: [{ Name: 'my-bucket' }] })
    const nodes = await listBuckets(mockClient, 'us-east-1')
    expect(nodes[0].id).toBe('my-bucket')
    expect(nodes[0].type).toBe('s3')
    expect(nodes[0].status).toBe('running')
  })

  it('returns empty array on error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))
    expect(await listBuckets(mockClient, 'us-east-1')).toEqual([])
  })
})
