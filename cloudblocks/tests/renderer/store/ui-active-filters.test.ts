// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { NodeFilter } from '../../../src/renderer/store/ui'
import type { CloudNode } from '../../../src/renderer/types/cloud'

function makeNode(type: CloudNode['type']): CloudNode {
  return { id: type, type, label: type, status: 'running', region: 'us-east-1', metadata: {} }
}

describe('useUIStore — activeFilters', () => {
  beforeEach(() => {
    useUIStore.setState({ activeFilters: [] })
  })

  it('starts with empty activeFilters', () => {
    expect(useUIStore.getState().activeFilters).toEqual([])
  })

  it('addFilter adds a filter', () => {
    const f: NodeFilter = { id: 'test', label: 'Test', test: (n) => n.type === 'ec2' }
    useUIStore.getState().addFilter(f)
    expect(useUIStore.getState().activeFilters).toHaveLength(1)
    expect(useUIStore.getState().activeFilters[0].id).toBe('test')
  })

  it('addFilter replaces existing filter with same id (upsert)', () => {
    const f1: NodeFilter = { id: 'sidebar-type', label: 'EC2', test: (n) => n.type === 'ec2' }
    const f2: NodeFilter = { id: 'sidebar-type', label: 'S3',  test: (n) => n.type === 's3'  }
    useUIStore.getState().addFilter(f1)
    useUIStore.getState().addFilter(f2)
    const filters = useUIStore.getState().activeFilters
    expect(filters).toHaveLength(1)
    expect(filters[0].label).toBe('S3')
  })

  it('removeFilter removes by id', () => {
    const f: NodeFilter = { id: 'sidebar-type', label: 'EC2', test: (n) => n.type === 'ec2' }
    useUIStore.getState().addFilter(f)
    useUIStore.getState().removeFilter('sidebar-type')
    expect(useUIStore.getState().activeFilters).toHaveLength(0)
  })

  it('removeFilter is a no-op for unknown id', () => {
    useUIStore.getState().removeFilter('nonexistent')
    expect(useUIStore.getState().activeFilters).toHaveLength(0)
  })

  it('clearFilters removes all filters', () => {
    useUIStore.getState().addFilter({ id: 'a', label: 'A', test: () => true })
    useUIStore.getState().addFilter({ id: 'b', label: 'B', test: () => false })
    useUIStore.getState().clearFilters()
    expect(useUIStore.getState().activeFilters).toHaveLength(0)
  })

  it('multiple filters coexist', () => {
    useUIStore.getState().addFilter({ id: 'region-us-east-1', label: 'us-east-1', test: (n) => n.region === 'us-east-1' })
    useUIStore.getState().addFilter({ id: 'region-eu-west-1', label: 'eu-west-1', test: (n) => n.region === 'eu-west-1' })
    expect(useUIStore.getState().activeFilters).toHaveLength(2)
  })

  it('OR composition: node passes if any filter matches', () => {
    const ec2 = makeNode('ec2')
    const s3  = makeNode('s3')
    const rds = makeNode('rds')
    useUIStore.getState().addFilter({ id: 'type-ec2', label: 'EC2', test: (n) => n.type === 'ec2' })
    useUIStore.getState().addFilter({ id: 'type-s3',  label: 'S3',  test: (n) => n.type === 's3'  })
    const filters = useUIStore.getState().activeFilters
    expect(filters.some((f) => f.test(ec2))).toBe(true)
    expect(filters.some((f) => f.test(s3))).toBe(true)
    expect(filters.some((f) => f.test(rds))).toBe(false)
  })
})
