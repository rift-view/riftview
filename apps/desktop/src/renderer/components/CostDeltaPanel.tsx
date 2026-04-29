/**
 * RIFT-21: Cost-delta preview panel — shown before confirmation in the restore flow.
 *
 * Displays a compact three-row summary of the cost impact of a restore plan:
 *   Added    +$X/mo  (resources being created)
 *   Removed  -$Y/mo  (resources being destroyed)
 *   Net      ±$Z/mo  (aggregate monthly delta)
 *
 * Consumer: the RIFT-19 restore wizard. Wire via window.riftview.restore.estimateCostDelta
 * after planRestore resolves, passing the returned planToken.
 */

import type { CostDelta } from '@riftview/cloud-scan'

interface CostDeltaPanelProps {
  /** The cost delta from RESTORE_COST_ESTIMATE. Null while loading or unavailable. */
  costDelta: CostDelta | null
  /** Show a loading shimmer instead of numbers. */
  isLoading?: boolean
}

function formatMonthly(dollars: number): string {
  if (dollars === 0) return '$0/mo'
  const sign = dollars > 0 ? '+' : '-'
  return `${sign}$${Math.abs(dollars).toFixed(2)}/mo`
}

function confidenceLabel(confidence: string): string {
  if (confidence === 'exact') return 'exact'
  if (confidence === 'estimate') return 'estimated'
  return 'unknown'
}

function deriveAddedRemoved(costDelta: CostDelta): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const entry of Object.values(costDelta.perStep)) {
    if (entry.recurringMonthly > 0) added += entry.recurringMonthly
    else if (entry.recurringMonthly < 0) removed += entry.recurringMonthly
  }
  return { added: Number(added.toFixed(2)), removed: Number(removed.toFixed(2)) }
}

/** Compact three-row cost preview panel for the restore confirmation step. */
export function CostDeltaPanel({ costDelta, isLoading }: CostDeltaPanelProps): React.JSX.Element {
  const net = costDelta?.aggregate.recurringMonthly ?? 0
  const confidence = costDelta?.aggregate.confidence ?? 'unknown'
  const { added, removed } = costDelta ? deriveAddedRemoved(costDelta) : { added: 0, removed: 0 }

  const netColor =
    net > 0
      ? 'var(--danger, #f87171)'
      : net < 0
        ? 'var(--success, #4ade80)'
        : 'var(--fg-muted, #94a3b8)'

  return (
    <div data-testid="cost-delta-panel" className="insp-section" style={{ marginTop: 0 }}>
      <div className="hairline" />
      <div className="eyebrow" style={{ paddingBottom: 6 }}>
        COST DELTA
        {costDelta && (
          <span
            style={{
              marginLeft: 6,
              fontSize: 9,
              opacity: 0.6,
              letterSpacing: '0.04em',
              textTransform: 'none'
            }}
          >
            ({confidenceLabel(confidence)})
          </span>
        )}
      </div>

      {isLoading ? (
        <div
          data-testid="cost-delta-loading"
          style={{
            height: 54,
            background: 'var(--surface-2, rgba(255,255,255,0.04))',
            borderRadius: 4
          }}
        />
      ) : costDelta === null ? (
        <div style={{ fontSize: 11, opacity: 0.5, padding: '4px 0' }}>
          Cost estimate unavailable
        </div>
      ) : (
        <div className="insp-rows">
          <div className="insp-row">
            <span className="k">Added</span>
            <span
              className="v"
              data-testid="cost-delta-added"
              style={{ color: added > 0 ? 'var(--danger, #f87171)' : undefined }}
            >
              {formatMonthly(added)}
            </span>
          </div>
          <div className="insp-row">
            <span className="k">Removed</span>
            <span
              className="v"
              data-testid="cost-delta-removed"
              style={{ color: removed < 0 ? 'var(--success, #4ade80)' : undefined }}
            >
              {formatMonthly(removed)}
            </span>
          </div>
          <div
            className="insp-row"
            style={{ borderTop: '1px solid var(--border, #334155)', marginTop: 4, paddingTop: 4 }}
          >
            <span className="k" style={{ fontWeight: 600 }}>
              Net
            </span>
            <span
              className="v"
              data-testid="cost-delta-net"
              style={{ color: netColor, fontWeight: 600 }}
            >
              {formatMonthly(net)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
