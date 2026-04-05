import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ECRClient } from '@aws-sdk/client-ecr'
import { listRepositories } from '../../../../src/main/aws/services/ecr'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ECRClient

const REPO_ARN  = 'arn:aws:ecr:us-east-1:123456789012:repository/my-app'
const REPO_ARN2 = 'arn:aws:ecr:us-east-1:123456789012:repository/my-app-2'
const REPO_URI  = '123456789012.dkr.ecr.us-east-1.amazonaws.com/my-app'

describe('listRepositories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps a repository to a CloudNode', async () => {
    mockSend.mockResolvedValueOnce({
      repositories: [{
        repositoryArn:  REPO_ARN,
        repositoryName: 'my-app',
        repositoryUri:  REPO_URI,
      }],
    })

    const nodes = await listRepositories(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('ecr-repo')
    expect(nodes[0].id).toBe(REPO_ARN)
    expect(nodes[0].label).toBe('my-app')
    expect(nodes[0].status).toBe('running')
    expect(nodes[0].region).toBe('us-east-1')
  })

  it('stores repository URI in metadata', async () => {
    mockSend.mockResolvedValueOnce({
      repositories: [{
        repositoryArn:  REPO_ARN,
        repositoryName: 'my-app',
        repositoryUri:  REPO_URI,
      }],
    })

    const nodes = await listRepositories(mockClient, 'us-east-1')

    expect(nodes[0].metadata.uri).toBe(REPO_URI)
  })

  it('falls back to empty string when ARN and name are missing', async () => {
    mockSend.mockResolvedValueOnce({
      repositories: [{
        repositoryArn:  undefined,
        repositoryName: undefined,
        repositoryUri:  undefined,
      }],
    })

    const nodes = await listRepositories(mockClient, 'us-east-1')

    expect(nodes[0].id).toBe('')
    expect(nodes[0].label).toBe('')
    expect(nodes[0].metadata.uri).toBe('')
  })

  it('paginates across multiple pages', async () => {
    mockSend
      .mockResolvedValueOnce({
        repositories: [{ repositoryArn: REPO_ARN,  repositoryName: 'my-app',   repositoryUri: REPO_URI }],
        nextToken: 'tok1',
      })
      .mockResolvedValueOnce({
        repositories: [{ repositoryArn: REPO_ARN2, repositoryName: 'my-app-2', repositoryUri: '' }],
        nextToken: undefined,
      })

    const nodes = await listRepositories(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(2)
    expect(nodes.map(n => n.id).sort()).toEqual([REPO_ARN, REPO_ARN2].sort())
  })

  it('returns empty array when no repositories exist', async () => {
    mockSend.mockResolvedValueOnce({ repositories: [] })

    const nodes = await listRepositories(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })

  it('returns empty array on API error', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDenied'))

    const nodes = await listRepositories(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
