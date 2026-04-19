import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SaveViewModal } from '../SaveViewModal'

describe('SaveViewModal', () => {
  it('renders with empty name for a new slot', () => {
    render(<SaveViewModal slot={0} initialName="" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('')
  })

  it('renders pre-filled when slot already has a name', () => {
    render(<SaveViewModal slot={2} initialName="Prod Layout" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Prod Layout')
  })

  it('enforces maxLength of 24 on the input', () => {
    render(<SaveViewModal slot={0} initialName="" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('maxLength', '24')
  })

  it('shows the 1-based slot number in the title', () => {
    render(<SaveViewModal slot={2} initialName="" onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/slot 3/i)).toBeInTheDocument()
  })

  it('calls onSave with the typed name when Save is clicked', () => {
    const onSave = vi.fn()
    render(<SaveViewModal slot={1} initialName="" onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'My Layout' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledWith('My Layout')
  })

  it('calls onCancel and does not call onSave when Cancel is clicked', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    render(<SaveViewModal slot={0} initialName="Existing" onSave={onSave} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('submits on Enter key', () => {
    const onSave = vi.fn()
    render(<SaveViewModal slot={0} initialName="" onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Quick Save' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onSave).toHaveBeenCalledWith('Quick Save')
  })

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn()
    render(<SaveViewModal slot={0} initialName="" onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
