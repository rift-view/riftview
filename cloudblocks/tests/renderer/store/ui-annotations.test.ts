import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../../../src/renderer/store/ui'
import type { StickyNote } from '../../../src/renderer/store/ui'


describe('useUIStore — annotations', () => {
  beforeEach(() => {
    useUIStore.setState({ annotations: {}, stickyNotes: [] })
  })

  it('setAnnotation stores a note keyed by nodeId', () => {
    useUIStore.getState().setAnnotation('i-001', 'my note')
    expect(useUIStore.getState().annotations['i-001']).toBe('my note')
  })

  it('clearAnnotation removes the note', () => {
    useUIStore.getState().setAnnotation('i-001', 'my note')
    useUIStore.getState().clearAnnotation('i-001')
    expect(useUIStore.getState().annotations['i-001']).toBeUndefined()
  })

  it('setAnnotations bulk-replaces all annotations', () => {
    useUIStore.getState().setAnnotation('i-001', 'old')
    useUIStore.getState().setAnnotations({ 'i-002': 'new', 'sticky:sn-1': 'hello' })
    const ann = useUIStore.getState().annotations
    expect(ann['i-001']).toBeUndefined()
    expect(ann['i-002']).toBe('new')
    expect(ann['sticky:sn-1']).toBe('hello')
  })
})

describe('useUIStore — stickyNotes', () => {
  beforeEach(() => {
    useUIStore.setState({ annotations: {}, stickyNotes: [] })
  })

  it('addStickyNote appends a new sticky note', () => {
    const note: StickyNote = { id: 'sn-1', content: 'hello', position: { x: 0, y: 0 } }
    useUIStore.getState().addStickyNote(note)
    expect(useUIStore.getState().stickyNotes).toHaveLength(1)
    expect(useUIStore.getState().stickyNotes[0].id).toBe('sn-1')
  })

  it('updateStickyNote updates content by id', () => {
    const note: StickyNote = { id: 'sn-1', content: 'hello', position: { x: 0, y: 0 } }
    useUIStore.getState().addStickyNote(note)
    useUIStore.getState().updateStickyNote('sn-1', 'world')
    expect(useUIStore.getState().stickyNotes[0].content).toBe('world')
  })

  it('removeStickyNote removes the note by id', () => {
    const note: StickyNote = { id: 'sn-1', content: 'hello', position: { x: 0, y: 0 } }
    useUIStore.getState().addStickyNote(note)
    useUIStore.getState().removeStickyNote('sn-1')
    expect(useUIStore.getState().stickyNotes).toHaveLength(0)
  })

  it('does not affect other notes when removing by id', () => {
    useUIStore.getState().addStickyNote({ id: 'sn-1', content: 'a', position: { x: 0, y: 0 } })
    useUIStore.getState().addStickyNote({ id: 'sn-2', content: 'b', position: { x: 0, y: 0 } })
    useUIStore.getState().removeStickyNote('sn-1')
    expect(useUIStore.getState().stickyNotes).toHaveLength(1)
    expect(useUIStore.getState().stickyNotes[0].id).toBe('sn-2')
  })
})
