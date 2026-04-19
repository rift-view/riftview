import React, { useState } from 'react'
import type { IamAnalysisResult, IamFinding, IamSeverity } from '../types/iam'
import type { CloudNode } from '../types/cloud'

interface IamAdvisorProps {
  node: CloudNode
}

const SEVERITY_COLOR: Record<IamSeverity, string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6'
}

const SEVERITY_LABEL: Record<IamSeverity, string> = {
  critical: 'CRITICAL',
  warning: 'WARNING',
  info: 'INFO'
}

function FindingRow({ finding }: { finding: IamFinding }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      style={{
        borderLeft: `3px solid ${SEVERITY_COLOR[finding.severity]}`,
        paddingLeft: 8,
        marginBottom: 6
      }}
    >
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
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: SEVERITY_COLOR[finding.severity],
            letterSpacing: '0.05em',
            minWidth: 50
          }}
        >
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cb-text-primary)', flex: 1 }}>
          {finding.title}
        </span>
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
        <div style={{ fontSize: 10, color: 'var(--cb-text-muted)', marginTop: 2 }}>
          {finding.detail}
        </div>
      )}
      {expanded && finding.statement && (
        <pre
          style={{
            fontSize: 9,
            background: 'var(--cb-bg-secondary)',
            padding: '6px 8px',
            borderRadius: 4,
            marginTop: 4,
            overflowX: 'auto',
            maxHeight: 200,
            color: 'var(--cb-text-muted)'
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
    <div style={{ marginTop: 12, borderTop: '1px solid var(--cb-border-strong)', paddingTop: 8 }}>
      {/* Section header with toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: open ? 8 : 0
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: 9, color: 'var(--cb-text-muted)' }}>{open ? '▼' : '▶'}</span>
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: 'var(--cb-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          IAM Permissions
        </span>
      </button>

      {open && (
        <div>
          {/* Analyze button — first run */}
          {!loading && !hasRun && (
            <button
              onClick={runAnalysis}
              style={{
                width: '100%',
                background: 'var(--cb-bg-elevated)',
                border: '1px solid var(--cb-accent)',
                borderRadius: 2,
                padding: '3px 0',
                color: 'var(--cb-accent)',
                fontFamily: 'monospace',
                fontSize: 9,
                cursor: 'pointer'
              }}
            >
              Analyze
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ fontSize: 11, color: 'var(--cb-text-muted)' }}>
              Analyzing IAM policies...
            </div>
          )}

          {/* Error state */}
          {!loading && result?.error && (
            <div
              style={{
                fontSize: 11,
                color: '#f59e0b',
                padding: '6px 8px',
                borderRadius: 4,
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.3)',
                marginBottom: 6
              }}
            >
              Analysis failed — check permissions
            </div>
          )}

          {/* Results */}
          {!loading && result && !result.error && (
            <>
              {result.findings.length === 0 ? (
                <div style={{ fontSize: 11, color: '#10b981' }}>No issues found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {result.findings.map((f, i) => (
                    <FindingRow key={i} finding={f} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Re-analyze button — shown after first run, when not loading */}
          {hasRun && !loading && (
            <button
              onClick={runAnalysis}
              style={{
                marginTop: 6,
                background: 'none',
                border: 'none',
                color: 'var(--cb-text-muted)',
                fontFamily: 'monospace',
                fontSize: 9,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Re-analyze
            </button>
          )}
        </div>
      )}
    </div>
  )
}
