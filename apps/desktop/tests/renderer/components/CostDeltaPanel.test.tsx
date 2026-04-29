import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CostDeltaPanel } from '../../../src/renderer/components/CostDeltaPanel'
import type { CostDelta } from '@riftview/cloud-scan'

function makeDelta(overrides: Partial<CostDelta> = {}): CostDelta {
  return {
    planId: 'plan-1',
    perStep: {},
    aggregate: {
      currency: 'USD',
      oneTime: 0,
      recurringMonthly: 0,
      confidence: 'exact'
    },
    ...overrides
  }
}

describe('CostDeltaPanel', () => {
  it('renders null-state when costDelta is null', () => {
    render(<CostDeltaPanel costDelta={null} />)
    expect(screen.getByTestId('cost-delta-panel')).toBeTruthy()
    expect(screen.getByText('Cost estimate unavailable')).toBeTruthy()
  })

  it('renders loading shimmer when isLoading is true', () => {
    render(<CostDeltaPanel costDelta={null} isLoading />)
    expect(screen.getByTestId('cost-delta-loading')).toBeTruthy()
  })

  it('shows $0/mo for added, removed, net on an empty plan', () => {
    render(<CostDeltaPanel costDelta={makeDelta()} />)
    const added = screen.getByTestId('cost-delta-added')
    const removed = screen.getByTestId('cost-delta-removed')
    const net = screen.getByTestId('cost-delta-net')
    expect(added.textContent).toBe('$0/mo')
    expect(removed.textContent).toBe('$0/mo')
    expect(net.textContent).toBe('$0/mo')
  })

  it('correctly splits creates (added) and destroys (removed)', () => {
    const delta = makeDelta({
      perStep: {
        s1: { currency: 'USD', oneTime: 0, recurringMonthly: 32.85, confidence: 'estimate' },
        s2: { currency: 'USD', oneTime: 0, recurringMonthly: -15.0, confidence: 'exact' }
      },
      aggregate: { currency: 'USD', oneTime: 0, recurringMonthly: 17.85, confidence: 'estimate' }
    })
    render(<CostDeltaPanel costDelta={delta} />)
    expect(screen.getByTestId('cost-delta-added').textContent).toBe('+$32.85/mo')
    expect(screen.getByTestId('cost-delta-removed').textContent).toBe('-$15.00/mo')
    expect(screen.getByTestId('cost-delta-net').textContent).toBe('+$17.85/mo')
  })

  it('shows net as negative when cost is saved', () => {
    const delta = makeDelta({
      perStep: {
        s1: { currency: 'USD', oneTime: 0, recurringMonthly: -45.0, confidence: 'estimate' }
      },
      aggregate: { currency: 'USD', oneTime: 0, recurringMonthly: -45.0, confidence: 'estimate' }
    })
    render(<CostDeltaPanel costDelta={delta} />)
    expect(screen.getByTestId('cost-delta-net').textContent).toBe('-$45.00/mo')
  })

  it('shows confidence label from aggregate', () => {
    render(
      <CostDeltaPanel
        costDelta={makeDelta({
          aggregate: { currency: 'USD', oneTime: 0, recurringMonthly: 0, confidence: 'estimate' }
        })}
      />
    )
    expect(screen.getByText(/estimated/)).toBeTruthy()
  })

  it('renders the COST DELTA section heading', () => {
    render(<CostDeltaPanel costDelta={makeDelta()} />)
    expect(screen.getByText(/COST DELTA/)).toBeTruthy()
  })
})
