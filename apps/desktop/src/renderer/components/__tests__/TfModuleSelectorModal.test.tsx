import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TfModuleSelectorModal from '../modals/TfModuleSelectorModal'
import type { TfModuleInfo } from '../../types/tfstate'
import type { CloudNode } from '@riftview/shared'

function makeNode(id: string): CloudNode {
  return { id, type: 'aws:ec2', label: id, status: 'running', region: 'us-east-1', metadata: {} }
}

const moduleA: TfModuleInfo = {
  name: 'module-a',
  resourceCount: 3,
  nodes: [makeNode('a1'), makeNode('a2'), makeNode('a3')]
}

const moduleB: TfModuleInfo = {
  name: 'module-b',
  resourceCount: 5,
  nodes: [makeNode('b1'), makeNode('b2'), makeNode('b3'), makeNode('b4'), makeNode('b5')]
}

const moduleC: TfModuleInfo = {
  name: 'module-c',
  resourceCount: 7,
  nodes: [
    makeNode('c1'),
    makeNode('c2'),
    makeNode('c3'),
    makeNode('c4'),
    makeNode('c5'),
    makeNode('c6'),
    makeNode('c7')
  ]
}

describe('TfModuleSelectorModal', () => {
  it('renders module list with all checked by default', () => {
    render(
      <TfModuleSelectorModal
        modules={[moduleA, moduleB, moduleC]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('module-a')).toBeInTheDocument()
    expect(screen.getByText('module-b')).toBeInTheDocument()
    expect(screen.getByText('module-c')).toBeInTheDocument()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    checkboxes.forEach((cb) => expect(cb).toBeChecked())
  })

  it('shows total resource count in subtitle', () => {
    render(
      <TfModuleSelectorModal
        modules={[moduleA, moduleB, moduleC]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // totalResources = 3 + 5 + 7 = 15
    expect(screen.getByText(/15 total resources/i)).toBeInTheDocument()
  })

  it('Import Selected button is disabled when nothing checked', () => {
    render(
      <TfModuleSelectorModal
        modules={[moduleA, moduleB, moduleC]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const checkboxes = screen.getAllByRole('checkbox')
    checkboxes.forEach((cb) => fireEvent.click(cb))

    const importBtn = screen.getByRole('button', { name: /import selected/i })
    expect(importBtn).toBeDisabled()
  })

  it('Import Selected button shows selected count', () => {
    render(
      <TfModuleSelectorModal
        modules={[moduleA, moduleB, moduleC]}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    // Uncheck module-c, leaving module-a (3) + module-b (5) = 8 selected
    const checkboxes = screen.getAllByRole('checkbox')
    // All start checked; uncheck the third one (module-c)
    fireEvent.click(checkboxes[2])

    expect(screen.getByRole('button', { name: /import selected \(8\)/i })).toBeInTheDocument()
  })

  it('onConfirm called with nodes from selected modules only', () => {
    const onConfirm = vi.fn()
    render(
      <TfModuleSelectorModal
        modules={[moduleA, moduleB, moduleC]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    // Uncheck module-c
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[2])

    fireEvent.click(screen.getByRole('button', { name: /import selected/i }))

    expect(onConfirm).toHaveBeenCalledOnce()
    const calledWith: CloudNode[] = onConfirm.mock.calls[0][0]
    const calledIds = calledWith.map((n) => n.id)

    // Should contain all of module-a and module-b nodes
    expect(calledIds).toEqual(
      expect.arrayContaining(['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'b4', 'b5'])
    )
    // Should NOT contain module-c nodes
    expect(calledIds).not.toContain('c1')
  })

  it('onCancel called when Cancel clicked', () => {
    const onCancel = vi.fn()
    render(
      <TfModuleSelectorModal
        modules={[moduleA, moduleB, moduleC]}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('single module: skips list, shows confirm directly', () => {
    render(<TfModuleSelectorModal modules={[moduleA]} onConfirm={vi.fn()} onCancel={vi.fn()} />)

    // No checkboxes in single-module fast path
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)

    // Confirm button should be visible (not "Import Selected (...)" form)
    const importBtn = screen.getByRole('button', { name: /import 3/i })
    expect(importBtn).toBeInTheDocument()
    expect(importBtn).not.toBeDisabled()
  })
})
