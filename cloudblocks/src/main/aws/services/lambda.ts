import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function lambdaStatusToNodeStatus(state: string | undefined): NodeStatus {
  if (state === 'Active') return 'running'
  if (state === 'Inactive') return 'stopped'
  if (!state) return 'unknown'
  return 'pending'
}

export async function listFunctions(client: LambdaClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListFunctionsCommand({}))
    return (res.Functions ?? []).map((fn): CloudNode => ({
      id:       fn.FunctionArn ?? fn.FunctionName ?? 'unknown',
      type:     'lambda',
      label:    fn.FunctionName ?? 'Lambda',
      status:   lambdaStatusToNodeStatus(fn.State),
      region,
      metadata: { runtime: fn.Runtime, handler: fn.Handler },
      parentId: fn.VpcConfig?.VpcId,
    }))
  } catch {
    return []
  }
}
