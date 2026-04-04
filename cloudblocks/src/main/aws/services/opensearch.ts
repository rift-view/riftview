import { OpenSearchClient, ListDomainNamesCommand, DescribeDomainsCommand } from '@aws-sdk/client-opensearch'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function osStatusToNodeStatus(state: string | undefined): NodeStatus {
  if (state === 'Active')   return 'running'
  if (state === 'Creating') return 'creating'
  if (state === 'Deleting') return 'deleting'
  if (state === 'Failed')   return 'error'
  return 'unknown'
}

export async function listOpenSearchDomains(client: OpenSearchClient, region: string): Promise<CloudNode[]> {
  try {
    const listRes = await client.send(new ListDomainNamesCommand({}))
    const names = (listRes.DomainNames ?? []).map(d => d.DomainName).filter((n): n is string => !!n)
    if (names.length === 0) return []
    const descRes = await client.send(new DescribeDomainsCommand({ DomainNames: names }))
    return (descRes.DomainStatusList ?? []).map((domain): CloudNode => ({
      id:       domain.ARN ?? domain.DomainName ?? 'unknown',
      type:     'opensearch',
      label:    domain.DomainName ?? 'OpenSearch',
      status:   osStatusToNodeStatus(domain.DomainProcessingStatus),
      region,
      metadata: {
        engineVersion: domain.EngineVersion,
        endpoint:      domain.Endpoint ?? domain.Endpoints?.['vpc'],
      },
    }))
  } catch {
    return []
  }
}
