import React, { useState } from 'react'
import type { IamAnalysisResult, IamFinding, IamSeverity } from '../types/iam'

interface IamAdvisorProps {
  node: { id: string; type: string }
  onRecheck: () => void
  result: IamAnalysisResult | null  // null = loading
}

const SEVERITY_COLOR: Record<IamSeverity, string> = {
  critical: '#ef4444',
  warning:  '#f59e0b',
  info:     '#3b82f6',
}

const SEVERITY_LABEL: Record<IamSeverity, string> = {
  critical: 'CRITICAL',
  warning:  'WARNING',
  info:     'INFO',
}

function FindingRow({ finding }: { finding: IamFinding }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity]}`, paddingLeft: 8, marginBottom: 6 }}>
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: finding.statement ? 'pointer' : 'default' }}
        onClick={() => finding.statement && setExpanded(e => !e)}
      >
        <span style={{ fontSize: 9, fontWeight: 700, color: SEVERITY_COLOR[finding.severity], letterSpacing: '0.05em', minWidth: 50 }}>
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cb-text-primary)', flex: 1 }}>{finding.title}</span>
        {finding.statement && (
          <span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      {finding.policyName && (
        <div style={{ fontSize: 9, color: 'var(--cb-text-muted)', marginTop: 2 }}>
          Policy: {finding.policyName}
        </div>
      )}
      {finding.detail && (
        <div style={{ fontSize: 10, color: 'var(--cb-text-muted)', marginTop: 2 }}>{finding.detail}</div>
      )}
      {expanded && finding.statement && (
        <pre style={{ fontSize: 9, background: 'var(--cb-bg-secondary)', padding: '6px 8px', borderRadius: 4, marginTop: 4, overflowX: 'auto', maxHeight: 200, color: 'var(--cb-text-muted)' }}>
          {JSON.stringify(JSON.parse(finding.statement), null, 2)}
        </pre>
      )}
    </div>
  )
}

export function IamAdvisor({ onRecheck, result }: IamAdvisorProps): React.JSX.Element {
  return (
    <div style={{ marginTop: 16, borderTop: '1px solid var(--cb-border)', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cb-text-secondary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          IAM Advisor
        </span>
        <button
          onClick={onRecheck}
          style={{ fontSize: 10, color: 'var(--cb-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
        >
          re-check
        </button>
      </div>

      {result === null && (
        <div style={{ fontSize: 11, color: 'var(--cb-text-muted)' }}>Analyzing IAM policies...</div>
      )}

      {result !== null && result?.error && (
        <div style={{ fontSize: 11, color: '#f59e0b', padding: '6px 8px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          {result.error}
          {(result.error.includes('AccessDenied') || result.error.includes('not authorized')) && (
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--cb-text-muted)' }}>
              Required: iam:GetRolePolicy, iam:ListAttachedRolePolicies, iam:GetPolicy, iam:GetPolicyVersion, iam:ListRolePolicies, iam:GetInstanceProfile, s3:GetBucketPolicy
            </div>
          )}
        </div>
      )}

      {result !== null && !result?.error && result?.findings.length === 0 && (
        <div style={{ fontSize: 11, color: '#10b981' }}>No issues found</div>
      )}

      {result !== null && !result?.error && result?.findings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {result.findings.map((f, i) => (
            <FindingRow key={i} finding={f} />
          ))}
        </div>
      )}
    </div>
  )
}
