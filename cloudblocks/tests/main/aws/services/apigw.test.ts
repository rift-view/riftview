import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2'
import { listApis } from '../../../../src/main/aws/services/apigw'

const mockSend = vi.fn()
const mockClient = { send: mockSend } as unknown as ApiGatewayV2Client

describe('listApis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits trigger integration edge when route has Lambda AWS_PROXY integration', async () => {
    const lambdaArn = 'arn:aws:lambda:us-east-1:123456789012:function:my-fn'

    // GetApisCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ ApiId: 'api-123', Name: 'my-api', ProtocolType: 'HTTP', ApiEndpoint: 'https://api.example.com' }],
    })
    // GetIntegrationsCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ IntegrationId: 'integ-1', IntegrationType: 'AWS_PROXY', IntegrationUri: lambdaArn }],
    })
    // GetRoutesCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ RouteId: 'route-1', RouteKey: 'GET /hello', Target: 'integrations/integ-1' }],
    })

    const nodes = await listApis(mockClient, 'us-east-1')

    const routeNode = nodes.find((n) => n.type === 'apigw-route')
    expect(routeNode).toBeDefined()
    expect(routeNode!.integrations).toHaveLength(1)
    expect(routeNode!.integrations![0].targetId).toBe(lambdaArn)
    expect(routeNode!.integrations![0].edgeType).toBe('trigger')
  })

  it('does not emit integrations when route has no integration target', async () => {
    // GetApisCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ ApiId: 'api-123', Name: 'my-api', ProtocolType: 'HTTP', ApiEndpoint: 'https://api.example.com' }],
    })
    // GetIntegrationsCommand — no items
    mockSend.mockResolvedValueOnce({ Items: [] })
    // GetRoutesCommand — route with no Target
    mockSend.mockResolvedValueOnce({
      Items: [{ RouteId: 'route-1', RouteKey: 'GET /hello', Target: undefined }],
    })

    const nodes = await listApis(mockClient, 'us-east-1')

    const routeNode = nodes.find((n) => n.type === 'apigw-route')
    expect(routeNode).toBeDefined()
    expect(routeNode!.integrations).toBeUndefined()
  })

  it('does not emit integrations when integration URI is not a Lambda ARN', async () => {
    const nonLambdaUri = 'arn:aws:states:us-east-1:123456789012:stateMachine:my-sfn'

    // GetApisCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ ApiId: 'api-123', Name: 'my-api', ProtocolType: 'HTTP', ApiEndpoint: 'https://api.example.com' }],
    })
    // GetIntegrationsCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ IntegrationId: 'integ-1', IntegrationType: 'AWS_PROXY', IntegrationUri: nonLambdaUri }],
    })
    // GetRoutesCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ RouteId: 'route-1', RouteKey: 'POST /submit', Target: 'integrations/integ-1' }],
    })

    const nodes = await listApis(mockClient, 'us-east-1')

    const routeNode = nodes.find((n) => n.type === 'apigw-route')
    expect(routeNode).toBeDefined()
    expect(routeNode!.integrations).toBeUndefined()
  })

  it('returns just the API node when API has no routes', async () => {
    // GetApisCommand
    mockSend.mockResolvedValueOnce({
      Items: [{ ApiId: 'api-123', Name: 'my-api', ProtocolType: 'HTTP', ApiEndpoint: 'https://api.example.com' }],
    })
    // GetIntegrationsCommand — no items
    mockSend.mockResolvedValueOnce({ Items: [] })
    // GetRoutesCommand — no items
    mockSend.mockResolvedValueOnce({ Items: [] })

    const nodes = await listApis(mockClient, 'us-east-1')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('apigw')
    expect(nodes[0].id).toBe('api-123')
  })

  it('returns empty array on top-level error', async () => {
    mockSend.mockRejectedValueOnce(new Error('network failure'))

    const nodes = await listApis(mockClient, 'us-east-1')

    expect(nodes).toEqual([])
  })
})
