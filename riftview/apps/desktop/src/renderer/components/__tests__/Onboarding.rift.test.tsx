import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Onboarding } from '../Onboarding'

describe('Onboarding rift shape', () => {
  it('renders an .eyebrow "WELCOME TO RIFTVIEW"', () => {
    render(<Onboarding />)
    const eyebrow = screen.getByText('WELCOME TO RIFTVIEW')
    expect(eyebrow).toHaveClass('eyebrow')
  })

  it('renders an h1.empty-state-title with the hero tagline', () => {
    const { container } = render(<Onboarding />)
    const title = container.querySelector('h1.empty-state-title')
    expect(title).toBeTruthy()
    expect(title?.textContent).toMatch(/incident diagnostic layer AWS doesn't have/i)
  })

  it('renders at least two .hairline separators between sections', () => {
    const { container } = render(<Onboarding />)
    const hairlines = container.querySelectorAll('hr.hairline')
    expect(hairlines.length).toBeGreaterThanOrEqual(2)
  })

  it('renders STEP 1 — AWS CLI and STEP 2 — PROFILE as .label headings', () => {
    render(<Onboarding />)
    const step1 = screen.getByText(/STEP 1 — AWS CLI/i)
    expect(step1).toHaveClass('label')
    const step2 = screen.getByText(/STEP 2 — PROFILE/i)
    expect(step2).toHaveClass('label')
  })

  it('renders the AWS permissions disclosure as a <details> with summary', () => {
    const { container } = render(<Onboarding />)
    const details = container.querySelector('details')
    expect(details).toBeTruthy()
    const summary = details?.querySelector('summary')
    expect(summary).toBeTruthy()
    expect(summary?.textContent).toMatch(/Required AWS Permissions/i)
  })

  it('still lists at least 10 IAM actions inside the permissions disclosure', () => {
    const { container } = render(<Onboarding />)
    const items = container.querySelectorAll('details ul li')
    expect(items.length).toBeGreaterThanOrEqual(10)
  })
})
