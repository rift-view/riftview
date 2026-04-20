import { useUIStore } from '../store/ui'

interface Shortcut {
  keys: string[]
  desc: string
}

const NAVIGATION: Shortcut[] = [
  { keys: ['j', 'k'], desc: 'next / previous node' },
  { keys: ['Enter'], desc: 'fly to selected node' },
  { keys: ['/'], desc: 'search nodes' },
  { keys: ['1', '2', '3', '4'], desc: 'load saved view' }
]

const CANVAS: Shortcut[] = [
  { keys: ['Esc'], desc: 'clear selection' },
  { keys: ['r'], desc: 're-scan AWS' }
]

const OTHER: Shortcut[] = [{ keys: ['?'], desc: 'toggle this help' }]

function KbdRow({ shortcut }: { shortcut: Shortcut }): React.JSX.Element {
  return (
    <div className="kbd-row">
      <span className="kbd-row-keys">
        {shortcut.keys.map((k, i) => (
          <kbd key={i} className="kbd">
            {k}
          </kbd>
        ))}
      </span>
      <span className="kbd-row-desc">{shortcut.desc}</span>
    </div>
  )
}

function Group({ label, items }: { label: string; items: Shortcut[] }): React.JSX.Element {
  return (
    <section className="kbd-group">
      <span className="label">{label}</span>
      <div className="kbd-rows">
        {items.map((s, i) => (
          <KbdRow key={i} shortcut={s} />
        ))}
      </div>
    </section>
  )
}

export function KeyboardHelp(): React.JSX.Element | null {
  const open = useUIStore((s) => s.keyboardHelpOpen)
  const close = useUIStore((s) => s.setKeyboardHelpOpen)

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={() => close(false)}>
      <div
        className="modal modal--sm kbd-help"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <header className="modal-head">
          <div className="modal-head-text">
            <span className="eyebrow">KEYBOARD</span>
            <h2 className="modal-title">Shortcuts</h2>
          </div>
          <button className="modal-close" onClick={() => close(false)} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">
          <Group label="NAVIGATION" items={NAVIGATION} />
          <Group label="CANVAS" items={CANVAS} />
          <Group label="OTHER" items={OTHER} />
        </div>
      </div>
    </div>
  )
}
