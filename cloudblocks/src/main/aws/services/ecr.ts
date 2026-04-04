import { ECRClient, DescribeRepositoriesCommand } from '@aws-sdk/client-ecr'
import type { CloudNode } from '../../../renderer/types/cloud'

export async function listRepositories(client: ECRClient, region: string): Promise<CloudNode[]> {
  try {
    const repos: { repositoryArn?: string; repositoryName?: string; repositoryUri?: string }[] = []
    let nextToken: string | undefined
    do {
      const res = await client.send(new DescribeRepositoriesCommand({ nextToken }))
      repos.push(...(res.repositories ?? []))
      nextToken = res.nextToken
    } while (nextToken)
    return repos.map((item): CloudNode => ({
      id:       item.repositoryArn ?? '',
      type:     'ecr-repo',
      label:    item.repositoryName ?? '',
      status:   'running',
      region,
      metadata: { uri: item.repositoryUri ?? '' },
    }))
  } catch {
    return []
  }
}
