import { SESClient, ListIdentitiesCommand } from '@aws-sdk/client-ses'
import type { CloudNode } from '@riftview/shared'

export async function listIdentities(client: SESClient, region: string): Promise<CloudNode[]> {
  try {
    const nodes: CloudNode[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new ListIdentitiesCommand({ NextToken: nextToken }))
      for (const identity of res.Identities ?? []) {
        nodes.push({
          id: identity,
          type: 'aws:ses',
          label: identity,
          status: 'running',
          region,
          metadata: { identityType: identity.includes('@') ? 'email' : 'domain' }
        })
      }
      nextToken = res.NextToken
    } while (nextToken)
    return nodes
  } catch {
    return []
  }
}
