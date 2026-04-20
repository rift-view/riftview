import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { EmptyCanvasState } from '../canvas/EmptyCanvasState'
import { useCloudStore } from '../../store/cloud'
import { useUIStore } from '../../store/ui'

const DEFAULT_PROFILE = { name: 'default' }

beforeEach(() => {
  useCloudStore.setState({
    profile: DEFAULT_PROFILE,
    nodes: [],
    scanStatus: 'idle',
    region: 'us-east-1',
    selectedRegions: ['us-east-1']
  })
  useUIStore.setState({ showSettings: false })
})

describe('EmptyCanvasState rift shape', () => {
  describe('no-profile state', () => {
    beforeEach(() => useCloudStore.setState({ profile: { name: '' } }))

    it('renders .empty-state container with .empty-state-card', () => {
      const { container } = render(<EmptyCanvasState />)
      expect(container.querySelector('.empty-state')).toBeTruthy()
      expect(container.querySelector('.empty-state-card')).toBeTruthy()
    })

    it('renders an .eyebrow "NO PROFILE CONNECTED"', () => {
      render(<EmptyCanvasState />)
      const eyebrow = screen.getByText('NO PROFILE CONNECTED')
      expect(eyebrow).toHaveClass('eyebrow')
    })

    it('renders an .empty-state-title h1 with the headline', () => {
      const { container } = render(<EmptyCanvasState />)
      const title = container.querySelector('h1.empty-state-title')
      expect(title).toBeTruthy()
      expect(title?.textContent).toMatch(/Connect your AWS profile to get started/i)
    })

    it('renders body text inside .empty-state-body', () => {
      const { container } = render(<EmptyCanvasState />)
      expect(container.querySelector('.empty-state-body')).toBeTruthy()
    })

    it('renders the Open Settings CTA as a .btn .btn-primary', () => {
      const btn = screen.getByRole('button', { name: /open settings/i })
      expect(btn).toHaveClass('btn')
      expect(btn).toHaveClass('btn-primary')
    })
  })

  describe('scanning state', () => {
    beforeEach(() => useCloudStore.setState({ scanStatus: 'scanning' }))

    it('renders .empty-state with the scanning eyebrow', () => {
      const { container } = render(<EmptyCanvasState />)
      expect(container.querySelector('.empty-state')).toBeTruthy()
      const eyebrow = screen.getByText(/SCANNING INFRASTRUCTURE/i)
      expect(eyebrow).toHaveClass('eyebrow')
    })
  })

  describe('post-scan empty state', () => {
    it('renders REGION EMPTY eyebrow + Scan Again CTA after a scan completes with no nodes', async () => {
      const { rerender } = render(<EmptyCanvasState />)
      useCloudStore.setState({ scanStatus: 'scanning' })
      rerender(<EmptyCanvasState />)
      useCloudStore.setState({ scanStatus: 'idle' })
      rerender(<EmptyCanvasState />)
      const eyebrow = screen.getByText('REGION EMPTY')
      expect(eyebrow).toHaveClass('eyebrow')
      const btn = screen.getByRole('button', { name: /scan again/i })
      expect(btn).toHaveClass('btn')
      expect(btn).toHaveClass('btn-primary')
    })
  })

  describe('initial (ready-to-scan) state', () => {
    it('renders READY TO SCAN eyebrow + Start Scan CTA + Browse Templates ghost button', () => {
      render(<EmptyCanvasState />)
      const eyebrow = screen.getByText('READY TO SCAN')
      expect(eyebrow).toHaveClass('eyebrow')
      const start = screen.getByRole('button', { name: /start scan/i })
      expect(start).toHaveClass('btn')
      expect(start).toHaveClass('btn-primary')
      const tmpl = screen.getByRole('button', { name: /browse templates/i })
      expect(tmpl).toHaveClass('btn')
      expect(tmpl).toHaveClass('btn-ghost')
    })
  })
})
