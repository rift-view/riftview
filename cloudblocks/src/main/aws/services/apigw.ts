import {
  ApiGatewayV2Client,
  GetApisCommand,
  GetRoutesCommand,
  GetIntegrationsCommand,
  GetAuthorizersCommand,
} from '@aws-sdk/client-apigatewayv2'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

export async function listApis(client: ApiGatewayV2Client, region: string): Promise<CloudNode[]> {
  try {
    const apiNodes: CloudNode[] = []
    let nextToken: string | undefined

    do {
      const res = await client.send(new GetApisCommand({ NextToken: nextToken }))
      const items = res.Items ?? []

      for (const api of items) {
        if (api.ProtocolType !== 'HTTP') continue
        if (!api.ApiId) continue

        // Detect Cognito authorizers
        let apigwIntegrations: { targetId: string; edgeType: import('../../../renderer/types/cloud').EdgeType }[] | undefined
        try {
          const authRes = await client.send(new GetAuthorizersCommand({ ApiId: api.ApiId }))
          const cognitoIntegrations: { targetId: string; edgeType: import('../../../renderer/types/cloud').EdgeType }[] = []
          for (const auth of authRes.Items ?? []) {
            if (auth.AuthorizerType === 'JWT' && auth.JwtConfiguration?.Issuer) {
              // Extract userPoolId from Cognito issuer URL
              const match = auth.JwtConfiguration.Issuer.match(/\/([^/]+)$/)
              if (match?.[1]) {
                cognitoIntegrations.push({ targetId: match[1], edgeType: 'trigger' })
              }
            }
          }
          if (cognitoIntegrations.length > 0) apigwIntegrations = cognitoIntegrations
        } catch { /* ignore */ }

        apiNodes.push({
          id:     api.ApiId,
          type:   'apigw',
          label:  api.Name || api.ApiId,
          status: 'running',
          region,
          metadata: {
            endpoint:     api.ApiEndpoint ?? '',
            protocolType: 'HTTP',
            corsOrigins:  api.CorsConfiguration?.AllowOrigins ?? [],
          },
          ...(apigwIntegrations ? { integrations: apigwIntegrations } : {}),
        })
      }

      nextToken = res.NextToken
    } while (nextToken)

    // Fetch routes for each API in parallel
    const routeGroups = await Promise.all(
      apiNodes.map((api) => listRoutes(client, api.id, region))
    )

    return [...apiNodes, ...routeGroups.flat()]
  } catch {
    return []
  }
}

async function listRoutes(client: ApiGatewayV2Client, apiId: string, region: string): Promise<CloudNode[]> {
  try {
    // Build integration map: integrationId -> lambdaArn
    const integrationMap = new Map<string, string>()
    let intNextToken: string | undefined
    do {
      const intRes = await client.send(new GetIntegrationsCommand({ ApiId: apiId, NextToken: intNextToken }))
      for (const integration of intRes.Items ?? []) {
        if (
          integration.IntegrationId &&
          integration.IntegrationType === 'AWS_PROXY' &&
          integration.IntegrationUri
        ) {
          integrationMap.set(integration.IntegrationId, integration.IntegrationUri)
        }
      }
      intNextToken = intRes.NextToken
    } while (intNextToken)

    const routeNodes: CloudNode[] = []
    let nextToken: string | undefined

    do {
      const res = await client.send(new GetRoutesCommand({ ApiId: apiId, NextToken: nextToken }))
      for (const route of res.Items ?? []) {
        const routeKey = route.RouteKey ?? ''
        if (!route.RouteId || routeKey === '$default') continue

        // Parse "METHOD /path" from RouteKey
        const spaceIdx = routeKey.indexOf(' ')
        const method = spaceIdx >= 0 ? routeKey.slice(0, spaceIdx) : routeKey
        const path   = spaceIdx >= 0 ? routeKey.slice(spaceIdx + 1) : '/'

        // Resolve lambda ARN from integration target
        const target = route.Target
        let lambdaArn: string | undefined
        if (target) {
          const integrationId = target.replace('integrations/', '')
          lambdaArn = integrationMap.get(integrationId)
        }

        const integrations = lambdaArn?.startsWith('arn:aws:lambda:')
          ? [{ targetId: lambdaArn, edgeType: 'trigger' as EdgeType }]
          : []

        routeNodes.push({
          id:     `${apiId}/routes/${route.RouteId}`,
          type:   'apigw-route',
          label:  routeKey,
          status: 'running',
          region,
          metadata: {
            apiId,
            routeId:   route.RouteId,
            method,
            path,
            target:    target ?? undefined,
            lambdaArn: lambdaArn ?? undefined,
          },
          parentId: apiId,
          ...(integrations.length > 0 ? { integrations } : {}),
        })
      }
      nextToken = res.NextToken
    } while (nextToken)

    return routeNodes
  } catch {
    return []
  }
}
