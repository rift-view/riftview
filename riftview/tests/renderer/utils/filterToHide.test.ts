import { describe, it, expect } from 'vitest'
import {
  applyNodeFilters,
  filterEdgesByVisibleNodes
} from '../../../src/renderer/utils/filterToHide'
import type { CloudNode } from '../../../src/renderer/types/cloud'
import type { NodeFilter } from '../../../src/renderer/store/ui'
import type { Edge } from '@xyflow/react'

function node(id: string, type: CloudNode['type'] = 'ec2'): CloudNode {
  return { id, type, label: id, status: 'running', region: 'us-east-1', metadata: {} }
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target }
}

const typeFilter = (t: CloudNode['type']): NodeFilter => ({
  id: `type-${t}`,
  label: t,
  test: (n) => n.type === t
})

// ── 1. flowNodes exclusion ──────────────────────────────────────────────────

describe('applyNodeFilters — flowNodes exclusion', () => {
  it('returns all nodes when no filters are active', () => {
    const nodes = [node('a', 'ec2'), node('b', 'rds'), node('c', 's3')]
    expect(applyNodeFilters(nodes, [])).toHaveLength(3)
  })

  it('excludes nodes that do not match any active filter', () => {
    const nodes = [node('a', 'ec2'), node('b', 'rds'), node('c', 's3')]
    const result = applyNodeFilters(nodes, [typeFilter('ec2')])
    expect(result.map((n) => n.id)).toEqual(['a'])
  })

  it('uses OR composition — includes node matching any filter', () => {
    const nodes = [node('a', 'ec2'), node('b', 'rds'), node('c', 's3')]
    const result = applyNodeFilters(nodes, [typeFilter('ec2'), typeFilter('rds')])
    expect(result.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('returns empty array when no nodes match any filter', () => {
    const nodes = [node('a', 'ec2'), node('b', 'ec2')]
    const result = applyNodeFilters(nodes, [typeFilter('rds')])
    expect(result).toHaveLength(0)
  })

  it('does not mutate original array', () => {
    const nodes = [node('a', 'ec2'), node('b', 'rds')]
    const original = [...nodes]
    applyNodeFilters(nodes, [typeFilter('ec2')])
    expect(nodes).toEqual(original)
  })
})

// ── 2. orphaned edge behavior ───────────────────────────────────────────────

describe('filterEdgesByVisibleNodes — orphaned edge behavior', () => {
  it('keeps edges where both endpoints are visible', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')]
    const visibleIds = new Set(['a', 'b', 'c'])
    expect(filterEdgesByVisibleNodes(edges, visibleIds)).toHaveLength(2)
  })

  it('removes edge when source is hidden', () => {
    const edges = [edge('hidden', 'b'), edge('a', 'b')]
    const visibleIds = new Set(['a', 'b'])
    const result = filterEdgesByVisibleNodes(edges, visibleIds)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('a')
  })

  it('removes edge when target is hidden', () => {
    const edges = [edge('a', 'hidden'), edge('a', 'b')]
    const visibleIds = new Set(['a', 'b'])
    const result = filterEdgesByVisibleNodes(edges, visibleIds)
    expect(result).toHaveLength(1)
    expect(result[0].target).toBe('b')
  })

  it('removes all edges when all nodes are hidden', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')]
    const visibleIds = new Set<string>()
    expect(filterEdgesByVisibleNodes(edges, visibleIds)).toHaveLength(0)
  })

  it('returns all edges unchanged when no nodes are hidden (empty filter)', () => {
    const edges = [edge('a', 'b'), edge('c', 'd')]
    const visibleIds = new Set(['a', 'b', 'c', 'd'])
    expect(filterEdgesByVisibleNodes(edges, visibleIds)).toHaveLength(2)
  })
})

// ── 3. selection clear — selected node excluded by filter ───────────────────

describe('applyNodeFilters — selection clear precondition', () => {
  it('selected node is absent from result when it does not match filter', () => {
    const selectedId = 'rds-1'
    const nodes = [node('ec2-1', 'ec2'), node(selectedId, 'rds')]
    const visible = applyNodeFilters(nodes, [typeFilter('ec2')])
    const visibleIds = new Set(visible.map((n) => n.id))
    expect(visibleIds.has(selectedId)).toBe(false)
  })

  it('selected node is present in result when it matches the filter', () => {
    const selectedId = 'ec2-1'
    const nodes = [node(selectedId, 'ec2'), node('rds-1', 'rds')]
    const visible = applyNodeFilters(nodes, [typeFilter('ec2')])
    const visibleIds = new Set(visible.map((n) => n.id))
    expect(visibleIds.has(selectedId)).toBe(true)
  })
})
