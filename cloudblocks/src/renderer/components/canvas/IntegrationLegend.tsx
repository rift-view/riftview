import React, { useState, useEffect } from 'react'
import { EDGE_TYPE_STYLES } from './edges/IntegrationEdge'
import type { EdgeType } from '../../types/cloud'
import { useUIStore } from '../../store/ui'

export default function IntegrationLegend(): React.JSX.Element | null {
  const showIntegrations = useUIStore((s) => s.showIntegrations)
  const [dismissed, setDismissed] = useState(false)

  // Reset dismissed when integrations are re-enabled so the legend reappears
  useEffect(() => {
    if (showIntegrations) setDismissed(false)
  }, [showIntegrations])

  if (!showIntegrations || dismissed) return null

  return (
    <div
      style={{
        position:    'absolute',
        bottom:      12,
        left:        12,
        zIndex:      10,
        background:  'var(--cb-bg-panel)',
        border:      '1px solid var(--cb-border)',
        borderRadius: 6,
        padding:     '8px 10px',
        fontFamily:  'monospace',
        fontSize:    11,
        minWidth:    130,
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: 'var(--cb-text-secondary)', fontWeight: 600 }}>
          Integration Edges
        </span>
        <button
          onClick={() => setDismissed(true)}
          title="Dismiss"
          style={{
            marginLeft:  8,
            border:      'none',
            background:  'transparent',
            color:       'var(--cb-text-secondary)',
            cursor:      'pointer',
            fontSize:    13,
            lineHeight:  1,
            padding:     '0 2px',
          }}
        >
          ×
        </button>
      </div>

      {/* Edge type rows */}
      {(Object.entries(EDGE_TYPE_STYLES) as [EdgeType, { color: string; label: string }][]).map(
        ([edgeType, { color, label }]) => (
          <div
            key={edgeType}
            style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}
          >
            <span
              style={{
                display:      'inline-block',
                width:        8,
                height:       8,
                borderRadius: '50%',
                background:   color,
                flexShrink:   0,
              }}
            />
            <span style={{ color: 'var(--cb-text)' }}>{label}</span>
          </div>
        )
      )}
    </div>
  )
}
