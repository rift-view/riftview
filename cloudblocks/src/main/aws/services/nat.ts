import { EC2Client, DescribeNatGatewaysCommand } from '@aws-sdk/client-ec2'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function mapNatState(state: string | undefined): NodeStatus {
  switch (state) {
    case 'available': return 'running'
    case 'pending':   return 'pending'
    case 'deleting':
    case 'deleted':   return 'deleting'
    case 'failed':    return 'error'
    default:          return 'unknown'
  }
}

export async function listNatGateways(client: EC2Client, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeNatGatewaysCommand({}))
    return (res.NatGateways ?? []).map((item): CloudNode => {
      const id = item.NatGatewayId ?? ''
      const label = item.Tags?.find(t => t.Key === 'Name')?.Value ?? id
      return {
        id,
        type:     'nat-gateway',
        label,
        status:   mapNatState(item.State),
        region,
        metadata: { state: item.State ?? '' },
        parentId: item.VpcId,
      }
    })
  } catch {
    return []
  }
}
