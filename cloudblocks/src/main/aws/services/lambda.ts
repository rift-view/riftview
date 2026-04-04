import { LambdaClient, ListFunctionsCommand, ListEventSourceMappingsCommand, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda'
import type { CloudNode, NodeStatus } from '../../../renderer/types/cloud'

function lambdaStatusToNodeStatus(state: string | undefined): NodeStatus {
  if (state === 'Active') return 'running'
  if (state === 'Inactive') return 'stopped'
  if (!state) return 'unknown'
  return 'pending'
}

function extractEnvVarIntegrations(
  envVars: Record<string, string> | undefined,
): { targetId: string; edgeType: 'trigger' }[] {
  if (!envVars) return []
  const results: { targetId: string; edgeType: 'trigger' }[] = []
  for (const value of Object.values(envVars)) {
    if (!value.includes('arn:aws:')) continue
    // Match ARN patterns for services whose node IDs are ARNs
    if (
      value.startsWith('arn:aws:sqs:') ||
      value.startsWith('arn:aws:sns:') ||
      value.startsWith('arn:aws:secretsmanager:') ||
      value.startsWith('arn:aws:states:')
    ) {
      results.push({ targetId: value, edgeType: 'trigger' })
    }
    // DynamoDB: ARN format arn:aws:dynamodb:region:account:table/TableName
    // Extract table name since DynamoDB node IDs are table names
    if (value.startsWith('arn:aws:dynamodb:') && value.includes(':table/')) {
      const tableName = value.split(':table/')[1]?.split('/')[0]
      if (tableName) results.push({ targetId: tableName, edgeType: 'trigger' })
    }
    // SES identity: plain email address → matches SES node ID
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      results.push({ targetId: value, edgeType: 'trigger' })
    }
    // RDS hostname: *.rds.amazonaws.com → resolved to RDS node via metadata.endpoint
    if (/\.rds\.amazonaws\.com$/.test(value)) {
      results.push({ targetId: value, edgeType: 'trigger' })
    }
  }
  return results
}

export async function listFunctions(client: LambdaClient, region: string): Promise<CloudNode[]> {
  try {
    const allFunctions: { FunctionArn?: string; FunctionName?: string; State?: string; Runtime?: string; Handler?: string; VpcConfig?: { VpcId?: string } }[] = []
    let marker: string | undefined
    do {
      const res = await client.send(new ListFunctionsCommand({ Marker: marker }))
      allFunctions.push(...(res.Functions ?? []))
      marker = res.NextMarker
    } while (marker)
    return Promise.all(allFunctions.map(async (fn): Promise<CloudNode> => {
      const allIntegrations: { targetId: string; edgeType: 'trigger' }[] = []
      // Add event source mappings (SQS triggers)
      try {
        const mappingsRes = await client.send(new ListEventSourceMappingsCommand({ FunctionName: fn.FunctionArn }))
        for (const m of mappingsRes.EventSourceMappings ?? []) {
          if (m.EventSourceArn?.startsWith('arn:aws:sqs:') || m.EventSourceArn?.startsWith('arn:aws:kinesis:')) {
            allIntegrations.push({ targetId: m.EventSourceArn!, edgeType: 'trigger' })
          }
        }
      } catch { /* ignore */ }
      // Add env var ARN integrations (dedup by targetId)
      try {
        const configRes = await client.send(new GetFunctionConfigurationCommand({ FunctionName: fn.FunctionArn }))
        const envVarIntegrations = extractEnvVarIntegrations(configRes.Environment?.Variables)
        const existingTargets = new Set(allIntegrations.map((i) => i.targetId))
        for (const i of envVarIntegrations) {
          if (!existingTargets.has(i.targetId)) {
            allIntegrations.push(i)
            existingTargets.add(i.targetId)
          }
        }
      } catch { /* ignore */ }
      const integrations = allIntegrations.length > 0 ? allIntegrations : undefined
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
