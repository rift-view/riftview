import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KinesisClient } from '@aws-sdk/client-kinesis'
import { listStreams } from '../../../../src/main/aws/services/kinesis'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as KinesisClient

const STREAM_ARN  = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream'
const STREAM_ARN2 = 'arn:aws:kinesis:us-east-1:123456789012:stream/my-stream-2'

describe('listStreams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a stream to a CloudNode', async () => {
    mockSend.mockResolvedValueOnce({
      StreamSummaries: [{
        StreamARN:    STREAM_ARN,
        StreamName:   'my-stream',
        StreamStatus: 'ACTIVE',
        StreamModeDetails: { StreamMode: 'PROVISIONED' },
      }],
    })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('kinesis')
    expect(nodes[0].id).toBe(STREAM_ARN)
    expect(nodes[0].label).toBe('my-stream')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores streamName, streamArn, and streamMode in metadata', async () => {
    mockSend.mockResolvedValueOnce({
      StreamSummaries: [{
        StreamARN:    STREAM_ARN,
        StreamName:   'my-stream',
        StreamStatus: 'ACTIVE',
        StreamModeDetails: { StreamMode: 'ON_DEMAND' },
      }],
    })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes[0].metadata.streamName).toBe('my-stream')
    expect(nodes[0].metadata.streamArn).toBe(STREAM_ARN)
    expect(nodes[0].metadata.streamMode).toBe('ON_DEMAND')
  })

  it('defaults streamMode to PROVISIONED when StreamModeDetails is absent', async () => {
    mockSend.mockResolvedValueOnce({
      StreamSummaries: [{
        StreamARN:    STREAM_ARN,
        StreamName:   'my-stream',
        StreamStatus: 'ACTIVE',
        StreamModeDetails: undefined,
      }],
    })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes[0].metadata.streamMode).toBe('PROVISIONED')
  })

  it.each([
    ['ACTIVE',   'running'],
    ['CREATING', 'pending'],
    ['DELETING', 'pending'],
    ['UPDATING', 'unknown'],
  ])('maps StreamStatus %s to node status %s', async (streamStatus, expectedStatus) => {
    mockSend.mockResolvedValueOnce({
      StreamSummaries: [{ StreamARN: STREAM_ARN, StreamName: 'my-stream', StreamStatus: streamStatus }],
    })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes[0].status).toBe(expectedStatus)
  })

  it('uses StreamARN as label when StreamName is missing', async () => {
    mockSend.mockResolvedValueOnce({
      StreamSummaries: [{ StreamARN: STREAM_ARN, StreamName: undefined, StreamStatus: 'ACTIVE' }],
    })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes[0].label).toBe(STREAM_ARN)
  })

  it('skips entries without a StreamARN', async () => {
    mockSend.mockResolvedValueOnce({
      StreamSummaries: [
        { StreamARN: undefined, StreamName: 'no-arn', StreamStatus: 'ACTIVE' },
        { StreamARN: STREAM_ARN, StreamName: 'valid', StreamStatus: 'ACTIVE' },
      ],
    })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe(STREAM_ARN)
  })

  it('paginates across multiple pages', async () => {
    mockSend
      .mockResolvedValueOnce({
        StreamSummaries: [{ StreamARN: STREAM_ARN,  StreamName: 'my-stream',   StreamStatus: 'ACTIVE' }],
        NextToken: 'tok1',
      })
      .mockResolvedValueOnce({
        StreamSummaries: [{ StreamARN: STREAM_ARN2, StreamName: 'my-stream-2', StreamStatus: 'ACTIVE' }],
        NextToken: undefined,
      })

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id).sort()).toEqual([STREAM_ARN, STREAM_ARN2].sort())
  })

  it('returns empty array on API error', async () => {
    mockSend.mockRejectedValueOnce(new Error('network error'))

    const nodes = await listStreams(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
