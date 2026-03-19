import { LambdaClient, ListFunctionsCommand, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, NodeStatus, EdgeType } from '../../../renderer/types/cloud'

function lambdaStatusToNodeStatus(state: string | undefined): NodeStatus {
  if (state === 'Active') return 'running'
  if (state === 'Inactive') return 'stopped'
  if (!state) return 'unknown'
  return 'pending'
}

export async function listFunctions(client: LambdaClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListFunctionsCommand({}))
    const nodes: CloudNode[] = (res.Functions ?? []).map((fn): CloudNode => ({
      id:       fn.FunctionArn ?? fn.FunctionName ?? 'unknown',
      type:     'lambda',
      label:    fn.FunctionName ?? 'Lambda',
      status:   lambdaStatusToNodeStatus(fn.State),
      region,
      metadata: { runtime: fn.Runtime, handler: fn.Handler },
      parentId: fn.VpcConfig?.VpcId,
    }))

    const enriched = await Promise.all(
      nodes.map(async (node): Promise<CloudNode> => {
        const mappingRes = await client
          .send(new ListEventSourceMappingsCommand({ FunctionName: node.id }))
          .catch(() => ({ EventSourceMappings: [] }))

        const integrations = (mappingRes.EventSourceMappings ?? [])
          .filter((m): m is typeof m & { EventSourceArn: string } => m.EventSourceArn != null)
          .map((m): { targetId: string; edgeType: EdgeType } => ({
            targetId: m.EventSourceArn,
            edgeType: 'trigger',
          }))

        return integrations.length > 0 ? { ...node, integrations } : node
      })
    )

    return enriched
  } catch {
    return []
  }
}
