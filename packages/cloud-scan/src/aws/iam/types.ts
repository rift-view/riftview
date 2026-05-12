export type IamSeverity = 'critical' | 'warning' | 'info'

export interface IamFinding {
  severity: IamSeverity
  title: string
  detail: string
  policyName?: string
  statement?: string
}

export interface IamAnalysisResult {
  nodeId: string
  findings: IamFinding[]
  error?: string
  fetchedAt: number
}
