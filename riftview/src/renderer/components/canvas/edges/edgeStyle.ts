// Shared edge-styling helper for canvas views (TopologyView, GraphView,
// CommandView). Centralises Rift's flow vs structural vs custom edge visual
// language so all three views stay consistent.
//
// Usage: pass the returned object as `style` on a React Flow edge definition.
// IntegrationEdge / UserEdge merge caller-provided style LAST, so these values
// override the component's defaults.

import type { CSSProperties } from 'react'

export type EdgeKind = 'flow' | 'structural' | 'custom'

export interface EdgeStyle extends CSSProperties {
  stroke: string
  strokeWidth: number
  filter?: string
  strokeDasharray?: string
}

/**
 * edgeStyle — canonical Rift edge styling by kind.
 *
 * - flow: data/traffic paths (integrations, route→target, ALB→ECS). Solid
 *   ember, 1.5px, faint glow when selected.
 * - structural: containment/parent-child relationships. Thin edge-structural
 *   (warm ink) at 1px.
 * - custom: user-drawn annotation edges. Dashed ember at 1.5px.
 */
export function edgeStyle(kind: EdgeKind, selected: boolean): EdgeStyle {
  if (kind === 'flow') {
    return {
      stroke: selected ? 'var(--ember-500)' : 'var(--ember-700)',
      strokeWidth: selected ? 2 : 1.5,
      filter: selected ? 'drop-shadow(0 0 6px var(--ember-glow))' : undefined
    }
  }
  if (kind === 'custom') {
    return {
      stroke: 'var(--ember-500)',
      strokeWidth: 1.5,
      strokeDasharray: '4 3'
    }
  }
  // structural
  return {
    stroke: 'var(--edge-structural)',
    strokeWidth: 1
  }
}
