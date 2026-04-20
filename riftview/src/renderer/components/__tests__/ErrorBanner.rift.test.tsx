import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ErrorBanner } from '../ErrorBanner'

describe('ErrorBanner rift shape', () => {
  it('renders an eyebrow "ERROR" label', () => {
    render(<ErrorBanner message="boom" onDismiss={vi.fn()} />)
    const eyebrow = screen.getByText('ERROR')
    expect(eyebrow).toHaveClass('eyebrow')
  })

  it('renders the message alongside the eyebrow', () => {
    render(<ErrorBanner message="something failed" onDismiss={vi.fn()} />)
    expect(screen.getByText('something failed')).toBeInTheDocument()
  })

  it('dismiss button uses .btn-link and invokes onDismiss on click', () => {
    const onDismiss = vi.fn()
    render(<ErrorBanner message="boom" onDismiss={onDismiss} />)
    const btn = screen.getByTitle('Dismiss')
    expect(btn).toHaveClass('btn-link')
    fireEvent.click(btn)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
