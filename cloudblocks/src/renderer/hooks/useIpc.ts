import { useEffect } from 'react'
import { useCloudStore } from '../store/cloud'

// Subscribes to IPC events pushed from the main process and wires them
// into the Zustand store. Call once at the app root.
export function useIpc(): void {
  const applyDelta = useCloudStore((s) => s.applyDelta)
  const setScanStatus = useCloudStore((s) => s.setScanStatus)
  const setError = useCloudStore((s) => s.setError)
  const setKeyPairs = useCloudStore((s) => s.setKeyPairs)
  const setScanErrors = useCloudStore((s) => s.setScanErrors)

  useEffect(() => {
    const unsubDelta = window.terminus.onScanDelta((delta) => {
      // Capture the generation at the moment the delta arrives so stale
      // deltas from a previous profile/region scan are discarded.
      const generation = useCloudStore.getState().scanGeneration
      applyDelta(delta, generation)
      setScanErrors(delta.scanErrors ?? [])
    })
    const unsubStatus = window.terminus.onScanStatus((status) => {
      setScanStatus(status as 'idle' | 'scanning' | 'error')
    })
    const unsubConn = window.terminus.onConnStatus((status) => {
      if (status === 'error') {
        // Keep the generic fallback; the specific detail arrives via SCAN_ERROR_DETAIL and overrides.
        setError('Connection failed. Check your AWS credentials and network.')
      } else {
        setError(null)
      }
    })
    const unsubErrorDetail = window.terminus.onScanErrorDetail((detail) => {
      setError(detail.message)
    })
    const unsubKeypairs = window.terminus.onScanKeypairs((pairs: string[]) => {
      setKeyPairs(pairs)
    })
    return () => {
      unsubDelta()
      unsubStatus()
      unsubConn()
      unsubErrorDetail()
      unsubKeypairs()
    }
  }, [applyDelta, setScanStatus, setError, setKeyPairs, setScanErrors])
}
