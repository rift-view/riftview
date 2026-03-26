import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StickyNoteNode } from '../../../../../src/renderer/components/canvas/nodes/StickyNoteNode'
import type { NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', () => ({
  Handle:   () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}))

// Mock window.cloudblocks
Object.defineProperty(window, 'cloudblocks', {
  value: { saveAnnotations: vi.fn().mockResolvedValue(undefined) },
  writable: true,
})

const makeProps = (content = '', onSave = vi.fn(), onDelete = vi.fn()) =>
  ({
    id:       'sn-001',
    data:     { noteId: 'sn-001', content, onSave, onDelete },
    selected: false,
  }) as unknown as NodeProps

describe('StickyNoteNode', () => {
  it('renders the NOTE header label', () => {
    render(<StickyNoteNode {...makeProps()} />)
    expect(screen.getByText('NOTE')).toBeInTheDocument()
  })

  it('renders a textarea with the initial content', () => {
    render(<StickyNoteNode {...makeProps('hello world')} />)
    const ta = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(ta.value).toBe('hello world')
  })

  it('calls onSave with new content on blur', () => {
    const onSave = vi.fn()
    render(<StickyNoteNode {...makeProps('initial', onSave)} />)
    const ta = screen.getByRole('textbox')
    fireEvent.change(ta, { target: { value: 'updated' } })
    fireEvent.blur(ta)
    expect(onSave).toHaveBeenCalledWith('sn-001', 'updated')
  })

  it('calls onDelete when the ✕ button is clicked', () => {
    const onDelete = vi.fn()
    render(<StickyNoteNode {...makeProps('', vi.fn(), onDelete)} />)
    const btn = screen.getByTitle('Delete note')
    fireEvent.click(btn)
    expect(onDelete).toHaveBeenCalledWith('sn-001')
  })

  it('applies selected styling when selected', () => {
    const props = { ...makeProps(), selected: true } as unknown as NodeProps
    render(<StickyNoteNode {...props} />)
    const node = document.querySelector('[data-selected="true"]')
    expect(node).toBeInTheDocument()
  })
})
