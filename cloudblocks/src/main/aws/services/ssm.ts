import { SSMClient, DescribeParametersCommand } from '@aws-sdk/client-ssm'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listParameters(client: SSMClient, region: string): Promise<CloudNode[]> {
  const nodes: CloudNode[] = []
  let nextToken: string | undefined
  do {
    const res = await client.send(new DescribeParametersCommand({ NextToken: nextToken }))
    for (const p of res.Parameters ?? []) {
      nodes.push({
        id:     p.ARN ?? p.Name ?? '',
        type:   'ssm-param',
        label:  p.Name ?? '',
        status: 'running',
        region,
        metadata: { type: p.Type ?? '', tier: p.Tier ?? '' },
      })
    }
    nextToken = res.NextToken
  } while (nextToken)
  return nodes
}
