import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { CanvasToast } from '../CanvasToast'
import { useUIStore } from '../../store/ui'

beforeEach(() => {
  useUIStore.setState({ toast: null })
})

describe('CanvasToast rift shape', () => {
  it('renders nothing when toast is null', () => {
    const { container } = render(<CanvasToast />)
    expect(container.firstChild).toBeNull()
  })

  it('renders .rift-toast.rift-toast--success for type=success', () => {
    useUIStore.setState({ toast: { message: 'profile saved', type: 'success' } })
    const { container } = render(<CanvasToast />)
    const pill = container.querySelector('.rift-toast')
    expect(pill).toBeTruthy()
    expect(pill).toHaveClass('rift-toast--success')
    expect(screen.getByText('profile saved')).toBeInTheDocument()
  })

  it('renders .rift-toast.rift-toast--error for type=error', () => {
    useUIStore.setState({ toast: { message: 'scan failed', type: 'error' } })
    const { container } = render(<CanvasToast />)
    const pill = container.querySelector('.rift-toast')
    expect(pill).toBeTruthy()
    expect(pill).toHaveClass('rift-toast--error')
    expect(screen.getByText('scan failed')).toBeInTheDocument()
  })
})
