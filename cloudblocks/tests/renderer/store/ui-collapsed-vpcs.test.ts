// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'

describe('useUIStore — collapsedVpcs', () => {
  beforeEach(() => {
    useUIStore.setState({
      collapsedVpcs:   new Set<string>(),
      collapsedSubnets: new Set<string>(),
    })
  })

  it('defaults to empty Set', () => {
    expect(useUIStore.getState().collapsedVpcs.size).toBe(0)
  })

  it('toggleVpc adds an id', () => {
    useUIStore.getState().toggleVpc('vpc-123')
    expect(useUIStore.getState().collapsedVpcs.has('vpc-123')).toBe(true)
  })

  it('toggleVpc removes an id when toggled again', () => {
    useUIStore.getState().toggleVpc('vpc-123')
    useUIStore.getState().toggleVpc('vpc-123')
    expect(useUIStore.getState().collapsedVpcs.has('vpc-123')).toBe(false)
  })

  it('isVpcCollapsed reflects set membership', () => {
    expect(useUIStore.getState().isVpcCollapsed('vpc-abc')).toBe(false)
    useUIStore.getState().toggleVpc('vpc-abc')
    expect(useUIStore.getState().isVpcCollapsed('vpc-abc')).toBe(true)
    useUIStore.getState().toggleVpc('vpc-abc')
    expect(useUIStore.getState().isVpcCollapsed('vpc-abc')).toBe(false)
  })

  it('toggleSubnet and toggleVpc are independent', () => {
    useUIStore.getState().toggleVpc('vpc-1')
    useUIStore.getState().toggleSubnet('subnet-1')
    // VPC set unchanged by subnet toggle
    expect(useUIStore.getState().collapsedVpcs.has('vpc-1')).toBe(true)
    expect(useUIStore.getState().collapsedVpcs.has('subnet-1')).toBe(false)
    // Subnet set unchanged by VPC toggle
    expect(useUIStore.getState().collapsedSubnets.has('subnet-1')).toBe(true)
    expect(useUIStore.getState().collapsedSubnets.has('vpc-1')).toBe(false)
  })
})
