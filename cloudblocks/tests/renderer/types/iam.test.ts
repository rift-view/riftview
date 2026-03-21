import { describe, it, expect } from 'vitest'
import type { IamFinding, IamAnalysisResult, IamSeverity } from '../../../src/renderer/types/iam'

describe('IAM types', () => {
  it('IamFinding has required fields', () => {
    const f: IamFinding = { severity: 'critical', title: 'AdministratorAccess', detail: 'Full admin access' }
    expect(f.severity).toBe('critical')
  })

  it('IamAnalysisResult has nodeId, findings, fetchedAt', () => {
    const r: IamAnalysisResult = { nodeId: 'i-123', findings: [], fetchedAt: Date.now() }
    expect(r.nodeId).toBe('i-123')
  })

  it('severity levels are correct', () => {
    const severities: IamSeverity[] = ['critical', 'warning', 'info']
    expect(severities).toHaveLength(3)
  })
})
