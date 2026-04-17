import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardNav } from '../../../src/renderer/hooks/useKeyboardNav'

// Mock stores
vi.mock('../../../src/renderer/store/cloud', () => ({
  useCloudStore: {
    getState: vi.fn(() => ({
      nodes: [
        {
          id: 'a',
          type: 'lambda',
          label: 'Alpha',
          status: undefined,
          region: 'us-east-1',
          metadata: {}
        },
        {
          id: 'b',
          type: 'lambda',
          label: 'Beta',
          status: undefined,
          region: 'us-east-1',
          metadata: {}
        },
        {
          id: 'c',
          type: 'lambda',
          label: 'Gamma',
          status: undefined,
          region: 'us-east-1',
          metadata: {}
        }
      ]
    }))
  }
}))

const mockSelectNode = vi.fn()
const mockSetBlastRadiusId = vi.fn()
const mockSetPathTraceId = vi.fn()
const mockSetKeyboardHelpOpen = vi.fn()
let keyboardHelpOpen = false

vi.mock('../../../src/renderer/store/ui', () => ({
  useUIStore: Object.assign(
    vi.fn(() => ({})),
    {
      getState: vi.fn(() => ({
        selectedNodeId: null,
        activeCreate: null,
        keyboardHelpOpen,
        view: 'topology',
        selectNode: mockSelectNode,
        setBlastRadiusId: mockSetBlastRadiusId,
        setPathTraceId: mockSetPathTraceId,
        setKeyboardHelpOpen: mockSetKeyboardHelpOpen,
        loadView: vi.fn()
      }))
    }
  )
}))

// Mock window.terminus
Object.defineProperty(window, 'terminus', {
  value: { startScan: vi.fn(() => Promise.resolve()) },
  writable: true
})

function fireKey(key: string, target: EventTarget = document.body): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

describe('useKeyboardNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keyboardHelpOpen = false
  })

  afterEach(() => {})

  it('j selects the first node', () => {
    renderHook(() => useKeyboardNav())
    fireKey('j')
    expect(mockSelectNode).toHaveBeenCalledWith('a')
  })

  it('j then j selects the second node', () => {
    renderHook(() => useKeyboardNav())
    fireKey('j')
    fireKey('j')
    expect(mockSelectNode).toHaveBeenLastCalledWith('b')
  })

  it('k from index 0 wraps to last node', () => {
    renderHook(() => useKeyboardNav())
    fireKey('j') // index 0 = 'a'
    fireKey('k') // (0 - 1 + 3) % 3 = 2 = 'c'
    expect(mockSelectNode).toHaveBeenLastCalledWith('c')
  })

  it('Escape clears selection', () => {
    renderHook(() => useKeyboardNav())
    fireKey('Escape')
    expect(mockSelectNode).toHaveBeenCalledWith(null)
    expect(mockSetBlastRadiusId).toHaveBeenCalledWith(null)
    expect(mockSetPathTraceId).toHaveBeenCalledWith(null)
  })

  it('ignores keys when focus is inside an input', () => {
    renderHook(() => useKeyboardNav())
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireKey('j', input)
    expect(mockSelectNode).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
