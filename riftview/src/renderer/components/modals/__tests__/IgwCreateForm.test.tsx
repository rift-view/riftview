import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { IgwCreateForm } from '../IgwCreateForm'

describe('IgwCreateForm', () => {
  it('renders the Name Tag input', () => {
    render(<IgwCreateForm onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('my-igw')).toBeInTheDocument()
  })

  it('calls onChange with name when filled', () => {
    const onChange = vi.fn()
    render(<IgwCreateForm onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('my-igw'), { target: { value: 'main-igw' } })
    expect(onChange).toHaveBeenCalledWith({ resource: 'igw', name: 'main-igw' })
  })

  it('calls onChange with name undefined when field is cleared', () => {
    const onChange = vi.fn()
    render(<IgwCreateForm onChange={onChange} />)
    const input = screen.getByPlaceholderText('my-igw')
    fireEvent.change(input, { target: { value: 'temp' } })
    fireEvent.change(input, { target: { value: '' } })
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall).toEqual({ resource: 'igw', name: undefined })
  })
})
