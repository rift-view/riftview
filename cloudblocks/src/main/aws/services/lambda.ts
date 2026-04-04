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
    // SES identity: plain email address → matches SES node ID (check before ARN gate)
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      results.push({ targetId: value, edgeType: 'trigger' })
      continue
    }
    // RDS hostname: *.rds.amazonaws.com → resolved to RDS node via metadata.endpoint
    if (/\.rds\.amazonaws\.com$/.test(value)) {
      results.push({ targetId: value, edgeType: 'trigger' })
      continue
    }
    // OpenSearch: *.es.amazonaws.com or *.aoss.amazonaws.com
    if (/\.(es|aoss)\.amazonaws\.com/.test(value)) {
      const host = value.replace(/^https?:\/\//, '').split('/')[0] ?? value
      results.push({ targetId: host, edgeType: 'trigger' })
      continue
    }
    // ElastiCache: *.cache.amazonaws.com
    if (/\.cache\.amazonaws\.com$/.test(value)) {
      results.push({ targetId: value, edgeType: 'trigger' })
      continue
    }
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
    // S3: arn:aws:s3:::bucket-name or arn:aws:s3:::bucket-name/prefix
    if (value.startsWith('arn:aws:s3:::')) {
      const bucketName = value.replace('arn:aws:s3:::', '').split('/')[0]
      if (bucketName) results.push({ targetId: bucketName, edgeType: 'trigger' })
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
      // Add event source mappings (SQS / Kinesis / MSK triggers)
      try {
        const mappingsRes = await client.send(new ListEventSourceMappingsCommand({ FunctionName: fn.FunctionArn }))
        for (const m of mappingsRes.EventSourceMappings ?? []) {
          if (
            m.EventSourceArn?.startsWith('arn:aws:sqs:') ||
            m.EventSourceArn?.startsWith('arn:aws:kinesis:') ||
            m.EventSourceArn?.startsWith('arn:aws:kafka:')
          ) {
            allIntegrations.push({ targetId: m.EventSourceArn!, edgeType: 'trigger' })
          }
        }
      } catch { /* ignore */ }
      // Capture timeout/memory from config; also add env var ARN integrations
      let timeout: number | undefined
      let memorySize: number | undefined
      try {
        const configRes = await client.send(new GetFunctionConfigurationCommand({ FunctionName: fn.FunctionArn }))
        timeout = configRes.Timeout
        memorySize = configRes.MemorySize
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
        metadata: { runtime: fn.Runtime, handler: fn.Handler, timeout, memorySize },
        parentId: fn.VpcConfig?.VpcId,
        integrations,
      }
    }))
  } catch {
    return []
  }
}
