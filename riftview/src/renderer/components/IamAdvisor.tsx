import React, { useState } from 'react'
import type { IamAnalysisResult, IamFinding, IamSeverity } from '../types/iam'
import type { CloudNode } from '../types/cloud'

interface IamAdvisorProps {
  node: CloudNode
}

const SEVERITY_VARIANT: Record<IamSeverity, string> = {
  critical: 'advisory-card advisory-card--critical',
  warning: 'advisory-card',
  info: 'advisory-card'
}

const SEVERITY_COLOR: Record<IamSeverity, string> = {
  critical: 'var(--fault-500)',
  warning: 'var(--ember-500)',
  info: 'oklch(0.72 0.15 240)'
}

const SEVERITY_LABEL: Record<IamSeverity, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO'
}

function FindingRow({ finding }: { finding: IamFinding }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={SEVERITY_VARIANT[finding.severity]} style={{ marginBottom: 6 }}>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          cursor: finding.statement ? 'pointer' : 'default'
        }}
        onClick={() => finding.statement && setExpanded((e) => !e)}
      >
        <span
          className="label"
          style={{
            color: SEVERITY_COLOR[finding.severity],
            minWidth: 50,
            fontSize: 9
          }}
        >
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span className="advisory-title" style={{ flex: 1, marginBottom: 0 }}>
          {finding.title}
        </span>
        {finding.statement && (
          <span className="label" style={{ fontSize: 9 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      {finding.policyName && (
        <div className="advisory-body" style={{ marginTop: 4, marginBottom: 0 }}>
          Policy: {finding.policyName}
        </div>
      )}
      {finding.detail && (
        <div className="advisory-body" style={{ marginTop: 2, marginBottom: 0 }}>
          {finding.detail}
        </div>
      )}
      {expanded && finding.statement && (
        <pre
          style={{
            fontSize: 9,
            background: 'var(--bg-elev-2)',
            padding: '6px 8px',
            borderRadius: 4,
            marginTop: 6,
            overflowX: 'auto',
            maxHeight: 200,
            color: 'var(--fg-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {JSON.stringify(JSON.parse(finding.statement), null, 2)}
        </pre>
      )}
    </div>
  )
}

export function IamAdvisor({ node }: IamAdvisorProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<IamAnalysisResult | null>(null)
  const [hasRun, setHasRun] = useState(false)

  function runAnalysis(): void {
    setLoading(true)
    setHasRun(true)
    window.riftview
      .analyzeIam(node.id, node.type, node.metadata ?? {})
      .then((res) => {
        setResult(res)
        setLoading(false)
      })
      .catch((err: unknown) => {
        setResult({ nodeId: node.id, findings: [], error: String(err), fetchedAt: Date.now() })
        setLoading(false)
      })
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="insp-label"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: open ? 8 : 0,
          textAlign: 'left'
        }}
        aria-expanded={open}
      >
        <span>{open ? '▼' : '▶'}</span>
        <span>IAM PERMISSIONS</span>
      </button>

      {open && (
        <div>
          {!loading && !hasRun && (
            <button
              onClick={runAnalysis}
              className="btn btn-sm btn-primary"
              style={{ width: '100%' }}
            >
              Analyze
            </button>
          )}

          {loading && (
            <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
              Analyzing IAM policies…
            </div>
          )}

          {!loading && result?.error && (
            <div className="advisory-card" style={{ marginBottom: 6 }}>
              <div className="advisory-title">Analysis failed — check permissions</div>
            </div>
          )}

          {!loading && result && !result.error && (
            <>
              {result.findings.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--moss-500)' }}>No issues found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {result.findings.map((f, i) => (
                    <FindingRow key={i} finding={f} />
                  ))}
                </div>
              )}
            </>
          )}

          {hasRun && !loading && (
            <button
              onClick={runAnalysis}
              className="btn btn-sm btn-ghost"
              style={{ marginTop: 6, width: '100%' }}
            >
              Re-analyze
            </button>
          )}
        </div>
      )}
    </div>
  )
}
