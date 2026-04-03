import { LambdaClient, ListFunctionsCommand, ListEventSourceMappingsCommand } from '@aws-sdk/client-lambda'
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
    return Promise.all((res.Functions ?? []).map(async (fn): Promise<CloudNode> => {
      let integrations: CloudNode['integrations'] = undefined
      try {
        const mappingsRes = await client.send(new ListEventSourceMappingsCommand({ FunctionName: fn.FunctionArn }))
        const sqsTriggers = (mappingsRes.EventSourceMappings ?? [])
          .filter((m) => m.EventSourceArn?.startsWith('arn:aws:sqs:'))
        if (sqsTriggers.length > 0) {
          integrations = sqsTriggers.map((m) => ({ targetId: m.EventSourceArn!, edgeType: 'trigger' as const }))
        }
      } catch { /* ignore */ }
      return {
        id:       fn.FunctionArn ?? fn.FunctionName ?? 'unknown',
        type:     'lambda',
        label:    fn.FunctionName ?? 'Lambda',
        status:   lambdaStatusToNodeStatus(fn.State),
        region,
        metadata: { runtime: fn.Runtime, handler: fn.Handler },
        parentId: fn.VpcConfig?.VpcId,
        integrations,
      }
    }))
  } catch {
    return []
  }
}
