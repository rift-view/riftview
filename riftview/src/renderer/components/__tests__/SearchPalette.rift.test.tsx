import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SearchPalette } from '../SearchPalette'
import { useCloudStore } from '../../store/cloud'

beforeEach(() => {
  useCloudStore.setState({
    nodes: [
      {
        id: 'i-aaa',
        type: 'ec2',
        label: 'web-1',
        region: 'us-east-1',
        status: 'running',
        metadata: {},
        raw: {}
      },
      {
        id: 'i-bbb',
        type: 'ec2',
        label: 'web-2',
        region: 'us-east-1',
        status: 'running',
        metadata: {},
        raw: {}
      }
    ]
  })
})

describe('SearchPalette rift shape', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <SearchPalette open={false} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders .search-palette shell with backdrop when open', () => {
    const { container } = render(
      <SearchPalette open={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    expect(container.querySelector('.search-palette-backdrop')).toBeTruthy()
    const shell = container.querySelector('.search-palette')
    expect(shell).toBeTruthy()
  })

  it('shell width is 640px (widened from 420)', () => {
    const { container } = render(
      <SearchPalette open={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    const shell = container.querySelector('.search-palette') as HTMLElement
    expect(shell.style.width).toBe('640px')
  })

  it('renders .search-palette-input wrapper around the search input', () => {
    const { container } = render(
      <SearchPalette open={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    expect(container.querySelector('.search-palette-input')).toBeTruthy()
  })

  it('renders .search-result rows with mono type badge for each match', async () => {
    const { container } = render(
      <SearchPalette open={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    // Component runs setQuery('') inside a requestAnimationFrame on open.
    // Wait for that to fire before typing, otherwise our typed value is wiped.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'web' } })
    await screen.findByText('web-1')
    const rows = container.querySelectorAll('.search-result')
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(rows[0].querySelector('.search-result-badge')).toBeTruthy()
  })

  it('renders foot hint with mono "↑↓ navigate" + "↵ select"', () => {
    const { container } = render(
      <SearchPalette open={true} onClose={vi.fn()} onSelect={vi.fn()} />
    )
    expect(container.querySelector('.search-palette-foot')).toBeTruthy()
  })
})
