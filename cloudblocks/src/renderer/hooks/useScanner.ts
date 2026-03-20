import { useEffect, useRef } from 'react'
import { useCloudStore } from '../store/cloud'

// On mount: loads profiles, selects first profile + its default region
// (which starts the scanner in main).
export function useScanner(): { triggerScan: () => void } {
  const setProfile  = useCloudStore((s) => s.setProfile)
  const setRegion   = useCloudStore((s) => s.setRegion)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    window.cloudblocks.listProfiles().then((profiles) => {
      if (profiles.length === 0) return
      const first = profiles[0]
      setProfile(first)
      // selectProfile in main reads the default region and starts the scanner
      window.cloudblocks.selectProfile(first)
      // Sync the region selector in the renderer with what main will use
      if (first.region) {
        setRegion(first.region)
        window.cloudblocks.selectRegion(first.region)
      }
    })
  }, [setProfile, setRegion])

  return {
    triggerScan: () => {
      const { selectedRegions } = useCloudStore.getState()
      window.cloudblocks.startScan(selectedRegions)
    },
  }
}
