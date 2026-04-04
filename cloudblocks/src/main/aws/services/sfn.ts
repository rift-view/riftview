import { SFNClient, ListStateMachinesCommand, DescribeStateMachineCommand } from '@aws-sdk/client-sfn'
import type { CloudNode, EdgeType } from '../../../renderer/types/cloud'

function isKnownTarget(resource: string): boolean {
  if (resource.startsWith('arn:aws:lambda:')) return true
  if (resource.startsWith('arn:aws:sqs:')) return true
  if (resource.startsWith('arn:aws:sns:')) return true
  // Match real nested SFN ARNs (contain 'stateMachine') but not SDK integration resources
  // such as 'arn:aws:states:::lambda:invoke' which use triple-colon with no region/account.
  if (resource.startsWith('arn:aws:states:') && resource.includes('stateMachine')) return true
  return false
}

// DynamoDB SDK integration resource prefixes
const DYNAMO_RESOURCES = new Set([
  'arn:aws:states:::dynamodb:putItem',
  'arn:aws:states:::dynamodb:getItem',
  'arn:aws:states:::dynamodb:updateItem',
  'arn:aws:states:::dynamodb:deleteItem',
  'arn:aws:states:::dynamodb:query',
  'arn:aws:states:::dynamodb:scan',
])

function extractTargetArns(definition: string): { targetId: string; edgeType: EdgeType }[] {
  try {
    const parsed = JSON.parse(definition) as {
      States?: Record<string, {
        Resource?: unknown
        Parameters?: Record<string, unknown>
      }>
    }
    const seen = new Map<string, EdgeType>()
    for (const state of Object.values(parsed.States ?? {})) {
      const resource = state.Resource
      if (typeof resource === 'string') {
        if (isKnownTarget(resource)) {
          seen.set(resource, 'trigger')
        }
        // DynamoDB direct SDK integrations — extract table name from Parameters
        if (DYNAMO_RESOURCES.has(resource)) {
          const tableName = state.Parameters?.['TableName']
          if (typeof tableName === 'string') seen.set(tableName, 'trigger')
        }
      }
      // Lambda via Parameters.FunctionName
      const fnName = state.Parameters?.['FunctionName']
      if (typeof fnName === 'string' && fnName.startsWith('arn:aws:lambda:')) {
        seen.set(fnName, 'trigger')
      }
    }
    return Array.from(seen.entries()).map(([targetId, edgeType]) => ({ targetId, edgeType }))
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

        const integrations: { targetId: string; edgeType: EdgeType }[] = extractTargetArns(described.definition)
        if (integrations.length === 0) return base

        return { ...base, integrations }
      }),
    )
  } catch {
    return []
  }
}
