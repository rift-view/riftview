import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function rdsStatusToNodeStatus(status: string | undefined): NodeStatus {
  if (status === 'available') return 'running'
  if (status === 'stopped')   return 'stopped'
  if (!status)                return 'unknown'
  return 'pending'
}

export async function describeDBInstances(client: RDSClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new DescribeDBInstancesCommand({}))
    return (res.DBInstances ?? []).map((db): CloudNode => ({
      id:       db.DBInstanceIdentifier ?? 'unknown',
      type:     'rds',
      label:    db.DBInstanceIdentifier ?? 'RDS',
      status:   rdsStatusToNodeStatus(db.DBInstanceStatus),
      region,
      metadata: { engine: db.Engine, instanceClass: db.DBInstanceClass },
      parentId: db.DBSubnetGroup?.VpcId,
    }))
  } catch {
    return []
  }
}
