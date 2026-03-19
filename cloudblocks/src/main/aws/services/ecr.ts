import { ECRClient, DescribeRepositoriesCommand } from '@aws-sdk/client-ecr'
import type { CloudNode } from '../../../renderer/types/cloud'
import { scanFlatService } from './scanFlatService'

export async function listRepositories(client: ECRClient, region: string): Promise<CloudNode[]> {
  return scanFlatService(client, region, {
    fetch: async (c) => {
      const res = await c.send(new DescribeRepositoriesCommand({}))
      return res.repositories ?? []
    },
    map: (item, region): CloudNode => ({
      id:       item.repositoryArn ?? '',
      type:     'ecr-repo',
      label:    item.repositoryName ?? '',
      status:   'running',
      region,
      metadata: { uri: item.repositoryUri ?? '' },
    }),
  })
}
