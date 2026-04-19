import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
  type Statistic
} from '@aws-sdk/client-cloudwatch'

export interface CloudMetric {
  name: string
  value: number
  unit: string
}

export interface FetchMetricsParams {
  nodeType: string
  resourceId: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function fetchStat(
  cw: CloudWatchClient,
  namespace: string,
  metricName: string,
  dimensions: { Name: string; Value: string }[],
  stat: Statistic,
  endTime: Date,
  startTime: Date
): Promise<number | undefined> {
  const res = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      Statistics: [stat]
    })
  )
  const points = res.Datapoints ?? []
  if (points.length === 0) return undefined
  // Use most recent datapoint
  points.sort((a, b) => (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0))
  const pt = points[0]
  if (stat === 'Sum') return pt?.Sum
  if (stat === 'Average') return pt?.Average
  return undefined
}

async function fetchExtendedStat(
  cw: CloudWatchClient,
  namespace: string,
  metricName: string,
  dimensions: { Name: string; Value: string }[],
  extStat: string,
  endTime: Date,
  startTime: Date
): Promise<number | undefined> {
  const res = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: startTime,
      EndTime: endTime,
      Period: 300,
      ExtendedStatistics: [extStat]
    })
  )
  const points = res.Datapoints ?? []
  if (points.length === 0) return undefined
  points.sort((a, b) => (b.Timestamp?.getTime() ?? 0) - (a.Timestamp?.getTime() ?? 0))
  const pt = points[0]
  return pt?.ExtendedStatistics?.[extStat]
}

export async function fetchMetrics(
  cw: CloudWatchClient,
  params: FetchMetricsParams
): Promise<CloudMetric[]> {
  try {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000)
    const results: CloudMetric[] = []

    if (params.nodeType === 'lambda') {
      const dims = [{ Name: 'FunctionName', Value: params.resourceId }]
      const [errors, p99] = await Promise.all([
        fetchStat(cw, 'AWS/Lambda', 'Errors', dims, 'Sum', endTime, startTime),
        fetchExtendedStat(cw, 'AWS/Lambda', 'Duration', dims, 'p99', endTime, startTime)
      ])
      if (errors !== undefined)
        results.push({ name: 'Errors', value: round2(errors), unit: 'count' })
      if (p99 !== undefined) results.push({ name: 'p99Duration', value: round2(p99), unit: 'ms' })
    } else if (params.nodeType === 'rds') {
      const dims = [{ Name: 'DBInstanceIdentifier', Value: params.resourceId }]
      const [conns, cpu] = await Promise.all([
        fetchStat(cw, 'AWS/RDS', 'DatabaseConnections', dims, 'Average', endTime, startTime),
        fetchStat(cw, 'AWS/RDS', 'CPUUtilization', dims, 'Average', endTime, startTime)
      ])
      if (conns !== undefined)
        results.push({ name: 'Connections', value: round2(conns), unit: 'count' })
      if (cpu !== undefined) results.push({ name: 'CPU', value: round2(cpu), unit: '%' })
    } else if (params.nodeType === 'ecs') {
      const [clusterName, serviceName] = params.resourceId.split('/')
      if (!clusterName || !serviceName) return []
      const dims = [
        { Name: 'ClusterName', Value: clusterName },
        { Name: 'ServiceName', Value: serviceName }
      ]
      const [cpu, memory] = await Promise.all([
        fetchStat(cw, 'AWS/ECS', 'CPUUtilization', dims, 'Average', endTime, startTime),
        fetchStat(cw, 'AWS/ECS', 'MemoryUtilization', dims, 'Average', endTime, startTime)
      ])
      if (cpu !== undefined) results.push({ name: 'CPU', value: round2(cpu), unit: '%' })
      if (memory !== undefined) results.push({ name: 'Memory', value: round2(memory), unit: '%' })
    } else {
      return []
    }

    return results
  } catch {
    return []
  }
}
