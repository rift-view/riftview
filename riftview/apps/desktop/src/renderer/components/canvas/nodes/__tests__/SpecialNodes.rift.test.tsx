import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { NodeProps } from '@xyflow/react'
import { AcmNode } from '../AcmNode'
import { CloudFrontNode } from '../CloudFrontNode'
import { ApigwNode } from '../ApigwNode'
import { ApigwRouteNode } from '../ApigwRouteNode'
import { StickyNoteNode } from '../StickyNoteNode'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' }
}))

function makeProps(data: Record<string, unknown>, overrides: Partial<NodeProps> = {}): NodeProps {
  return {
    id: overrides.id ?? 'test-id',
    type: overrides.type ?? 'resource',
    selected: overrides.selected ?? false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    data
  } as unknown as NodeProps
}

describe('AcmNode (Rift editorial pattern)', () => {
  it('renders with the rift-node root class and correct eyebrow', () => {
    const { container } = render(
      <AcmNode {...makeProps({ label: 'example.com', status: 'running' }, { id: 'acm-1' })} />
    )
    const root = container.querySelector('.rift-node')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-node-type')).toBe('acm')
    const eye = container.querySelector('.rift-node-eye')
    expect(eye?.textContent).toContain('ACM')
  })

  it('renders domain name in rift-node-title and applies focused class when selected', () => {
    const { container } = render(
      <AcmNode
        {...makeProps({ label: 'api.example.com', status: 'running' }, { selected: true })}
      />
    )
    const title = container.querySelector('.rift-node-title')
    expect(title?.textContent).toBe('api.example.com')
    expect(container.querySelector('.rift-node--focused')).not.toBeNull()
  })
})

describe('CloudFrontNode (Rift editorial pattern)', () => {
  it('renders with the rift-node root class and CLOUDFRONT eyebrow', () => {
    const { container } = render(
      <CloudFrontNode {...makeProps({ label: 'dist-abc', status: 'running' })} />
    )
    const root = container.querySelector('.rift-node')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-node-type')).toBe('cloudfront')
    const eye = container.querySelector('.rift-node-eye')
    expect(eye?.textContent).toContain('CLOUDFRONT')
  })

  it('renders origin count in meta row when provided', () => {
    const { container } = render(
      <CloudFrontNode
        {...makeProps({
          label: 'dist-abc',
          status: 'running',
          metadata: { deployStatus: 'Deployed', originCount: 2 }
        })}
      />
    )
    const meta = container.querySelector('.rift-node-meta')
    expect(meta?.textContent).toContain('Deployed')
    expect(meta?.textContent).toContain('2 origins')
  })
})

describe('ApigwNode (Rift editorial pattern)', () => {
  it('renders with the rift-node root class and API GATEWAY eyebrow', () => {
    const { container } = render(
      <ApigwNode {...makeProps({ label: 'users-api', endpoint: 'HTTP' })} />
    )
    const root = container.querySelector('.rift-node')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-node-type')).toBe('apigw')
    const eye = container.querySelector('.rift-node-eye')
    expect(eye?.textContent).toContain('API GATEWAY')
  })

  it('renders endpoint type and route count in meta row', () => {
    const { container } = render(
      <ApigwNode {...makeProps({ label: 'users-api', endpoint: 'HTTP', routeCount: 3 })} />
    )
    const meta = container.querySelector('.rift-node-meta')
    expect(meta?.textContent).toContain('HTTP')
    expect(meta?.textContent).toContain('3 routes')
  })
})

describe('ApigwRouteNode (Rift editorial pattern)', () => {
  it('renders with the rift-node root class and API ROUTE eyebrow', () => {
    const { container } = render(
      <ApigwRouteNode
        {...makeProps({ label: 'GET /users/{id}', method: 'GET', path: '/users/{id}' })}
      />
    )
    const root = container.querySelector('.rift-node')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('data-node-type')).toBe('apigw-route')
    const eye = container.querySelector('.rift-node-eye')
    expect(eye?.textContent).toContain('API ROUTE')
  })

  it('renders method as a chip with .route-method class next to the path', () => {
    const { container } = render(
      <ApigwRouteNode
        {...makeProps({
          label: 'POST /orders',
          method: 'POST',
          path: '/orders',
          hasLambda: true
        })}
      />
    )
    const chip = container.querySelector('.route-method')
    expect(chip).not.toBeNull()
    expect(chip?.textContent).toBe('POST')
    const title = container.querySelector('.rift-node-title')
    expect(title?.textContent).toContain('/orders')
    const meta = container.querySelector('.rift-node-meta')
    expect(meta?.textContent).toContain('lambda')
  })
})

describe('StickyNoteNode (warm paper pattern)', () => {
  it('renders with the rift-sticky root class and NOTE eyebrow', () => {
    const { container } = render(
      <StickyNoteNode
        {...makeProps(
          {
            content: 'remember this',
            noteId: 'sn-1',
            onSave: vi.fn(),
            onDelete: vi.fn()
          },
          { id: 'sn-1' }
        )}
      />
    )
    const sticky = container.querySelector('.rift-sticky')
    expect(sticky).not.toBeNull()
    expect(sticky?.getAttribute('data-sticky-id')).toBe('sn-1')
    const eye = container.querySelector('.rift-node-eye')
    expect(eye?.textContent).toContain('NOTE')
  })

  it('renders the initial content in the editable sticky body and preserves delete button title', () => {
    const onDelete = vi.fn()
    const { container, getByRole, getByTitle } = render(
      <StickyNoteNode
        {...makeProps(
          {
            content: 'hello world',
            noteId: 'sn-2',
            onSave: vi.fn(),
            onDelete
          },
          { id: 'sn-2' }
        )}
      />
    )
    const ta = getByRole('textbox') as HTMLTextAreaElement
    expect(ta.value).toBe('hello world')
    expect(ta.classList.contains('rift-sticky-body')).toBe(true)
    // Delete button still present for legacy tests
    expect(getByTitle('Delete note')).not.toBeNull()
    // root remains inside rift-sticky container
    expect(container.querySelector('.rift-sticky')).not.toBeNull()
  })
})
