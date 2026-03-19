import { EC2Client, DescribeInternetGatewaysCommand } from '@aws-sdk/client-ec2'
import { scanFlatService } from './scanFlatService'
import type { CloudNode } from '../../../renderer/types/cloud'

export function listInternetGateways(client: EC2Client, region: string): Promise<CloudNode[]> {
  return scanFlatService(client, region, {
    fetch: async (c) => {
      const res = await c.send(new DescribeInternetGatewaysCommand({}))
      return res.InternetGateways ?? []
    },
    map: (item, region): CloudNode => {
      const id    = item.InternetGatewayId ?? ''
      const label = item.Tags?.find(t => t.Key === 'Name')?.Value ?? id
      const state = item.Attachments?.[0]?.State as string | undefined
      return {
        id,
        type:     'igw',
        label,
        status:   state === 'available' ? 'running' : 'unknown',
        region,
        metadata: { state: state ?? '' },
        parentId: item.Attachments?.[0]?.VpcId,
      }
    },
  })
}
