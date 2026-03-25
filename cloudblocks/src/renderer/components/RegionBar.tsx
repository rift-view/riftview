import { useState, useRef, useEffect } from 'react'
import { useCloudStore } from '../store/cloud'
import { buildRegionColorMap } from '../utils/regionColors'

const ALL_REGIONS = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1',
  'ap-southeast-1','ap-southeast-2','ap-northeast-1',
  'ap-south-1','sa-east-1','ca-central-1',
]

export function RegionBar(): React.JSX.Element {
  const selectedRegions    = useCloudStore((s) => s.selectedRegions)
  const setSelectedRegions = useCloudStore((s) => s.setSelectedRegions)
  const regionColors       = useCloudStore((s) => s.settings.regionColors)
  const [addOpen, setAddOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const colorMap = buildRegionColorMap(selectedRegions, regionColors)
  const showColors = selectedRegions.length >= 2

  useEffect(() => {
    if (!addOpen) return
    function handleOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [addOpen])

  function removeRegion(r: string): void {
    if (selectedRegions.length <= 1) return
    const next = selectedRegions.filter((x) => x !== r)
    setSelectedRegions(next)
    // Direct call intentional — RegionBar owns region selection, not useScanner
    window.cloudblocks.startScan(next)
  }

  function addRegion(r: string): void {
    const next = [...selectedRegions, r]
    setSelectedRegions(next)
    window.cloudblocks.startScan(next)
    setAddOpen(false)
  }

  const available = ALL_REGIONS.filter((r) => !selectedRegions.includes(r))

  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          6,
        padding:      '0 12px',
        height:       26,
        flexShrink:   0,
        background:   'var(--cb-bg-elevated)',
        borderBottom: '1px solid var(--cb-border)',
        fontFamily:   'monospace',
      }}
    >
      <span style={{ fontSize: 8, color: 'var(--cb-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: 2 }}>
        Regions
      </span>

      {selectedRegions.map((r) => (
        <span
          key={r}
          style={{
            display:      'inline-flex',
            alignItems:   'center',
            gap:          4,
            background:   'var(--cb-bg-panel)',
            border:       `1px solid ${showColors ? colorMap[r] : 'var(--cb-border)'}`,
            borderRadius: 10,
            padding:      '1px 7px',
            fontSize:     9,
            color:        'var(--cb-text-primary)',
          }}
        >
          {showColors && (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorMap[r], flexShrink: 0 }} />
          )}
          {r}
          {selectedRegions.length > 1 && (
            <button
              onClick={() => removeRegion(r)}
              style={{
                background: 'none', border: 'none', padding: 0, marginLeft: 2,
                color: 'var(--cb-text-muted)', cursor: 'pointer', fontSize: 9, lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}

      {available.length > 0 && (
        <div ref={containerRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAddOpen((o) => !o)}
            style={{
              background:   'none',
              border:       '1px dashed var(--cb-border)',
              borderRadius: 10,
              padding:      '1px 7px',
              fontSize:     9,
              color:        'var(--cb-text-muted)',
              cursor:       'pointer',
              fontFamily:   'monospace',
            }}
          >
            + add
          </button>
          {addOpen && (
            <div
              style={{
                position:     'absolute',
                top:          '100%',
                left:         0,
                zIndex:       200,
                marginTop:    4,
                background:   'var(--cb-bg-panel)',
                border:       '1px solid var(--cb-border)',
                borderRadius: 4,
                minWidth:     140,
                boxShadow:    '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {available.map((r) => (
                <button
                  key={r}
                  onClick={() => addRegion(r)}
                  style={{
                    display:    'block',
                    width:      '100%',
                    textAlign:  'left',
                    background: 'none',
                    border:     'none',
                    padding:    '5px 10px',
                    fontSize:   10,
                    color:      'var(--cb-text-secondary)',
                    cursor:     'pointer',
                    fontFamily: 'monospace',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--cb-bg-elevated)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
