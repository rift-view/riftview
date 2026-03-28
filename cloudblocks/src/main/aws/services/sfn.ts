import { SFNClient, ListStateMachinesCommand, DescribeStateMachineCommand } from '@aws-sdk/client-sfn'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

function extractLambdaArns(definition: string): string[] {
  try {
    const parsed = JSON.parse(definition) as {
      States?: Record<string, {
        Resource?: unknown
        Parameters?: { FunctionName?: unknown }
      }>
    }
    const arns = new Set<string>()
    for (const state of Object.values(parsed.States ?? {})) {
      if (typeof state.Resource === 'string' && state.Resource.startsWith('arn:aws:lambda:')) {
        arns.add(state.Resource)
      }
      const fnName = state.Parameters?.FunctionName
      if (typeof fnName === 'string' && fnName.startsWith('arn:aws:lambda:')) {
        arns.add(fnName)
      }
    }
    return Array.from(arns)
  } catch {
    return []
  }
}

export async function listStateMachines(client: SFNClient, region: string): Promise<CloudNode[]> {
  try {
    const res = await client.send(new ListStateMachinesCommand({}))
    const machines = res.stateMachines ?? []

    return Promise.all(
      machines.map(async (item): Promise<CloudNode> => {
        const base: CloudNode = {
          id:       item.stateMachineArn ?? '',
          type:     'sfn',
          label:    item.name ?? '',
          status:   'running',
          region,
          metadata: { type: item.type ?? '', createdAt: item.creationDate?.toISOString() ?? '' },
        }

        const described = await client
          .send(new DescribeStateMachineCommand({ stateMachineArn: item.stateMachineArn }))
          .catch(() => ({ definition: undefined }))

        if (!described.definition) return base

        const lambdaArns = extractLambdaArns(described.definition)
        if (lambdaArns.length === 0) return base

        const integrations: { targetId: string; edgeType: EdgeType }[] = lambdaArns.map((arn) => ({
          targetId: arn,
          edgeType: 'trigger' as EdgeType,
        }))

        return { ...base, integrations }
      }),
    )
  } catch {
    return []
  }
}
