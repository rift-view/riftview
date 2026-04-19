// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('useUIStore — expandedGroups', () => {
  beforeEach(() => {
    useUIStore.setState({ expandedGroups: new Set<string>() })
  })

  it('toggleGroupExpand adds an id when not present', () => {
    useUIStore.getState().toggleGroupExpand('group-subnet-1-lambda')
    expect(useUIStore.getState().isGroupExpanded('group-subnet-1-lambda')).toBe(true)
  })

  it('toggleGroupExpand removes an id when present', () => {
    useUIStore.getState().toggleGroupExpand('group-subnet-1-lambda')
    useUIStore.getState().toggleGroupExpand('group-subnet-1-lambda')
    expect(useUIStore.getState().isGroupExpanded('group-subnet-1-lambda')).toBe(false)
  })

  it('isGroupExpanded returns false for unknown id', () => {
    expect(useUIStore.getState().isGroupExpanded('group-subnet-99-ec2')).toBe(false)
  })

  it('toggling one group does not affect another', () => {
    useUIStore.getState().toggleGroupExpand('group-subnet-1-lambda')
    expect(useUIStore.getState().isGroupExpanded('group-subnet-1-ec2')).toBe(false)
  })

  it('multiple groups can be expanded simultaneously', () => {
    useUIStore.getState().toggleGroupExpand('group-subnet-1-lambda')
    useUIStore.getState().toggleGroupExpand('group-subnet-2-ec2')
    expect(useUIStore.getState().isGroupExpanded('group-subnet-1-lambda')).toBe(true)
    expect(useUIStore.getState().isGroupExpanded('group-subnet-2-ec2')).toBe(true)
  })
})
