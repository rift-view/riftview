import { useEffect } from 'react'
import { useCloudStore } from '../store/cloud'

// Subscribes to IPC events pushed from the main process and wires them
// into the Zustand store. Call once at the app root.
export function useIpc(): void {
  const applyDelta    = useCloudStore((s) => s.applyDelta)
  const setScanStatus = useCloudStore((s) => s.setScanStatus)
  const setError      = useCloudStore((s) => s.setError)

  useEffect(() => {
    const unsubDelta  = window.cloudblocks.onScanDelta((delta) => applyDelta(delta))
    const unsubStatus = window.cloudblocks.onScanStatus((status) => {
      setScanStatus(status as 'idle' | 'scanning' | 'error')
    })
    const unsubConn = window.cloudblocks.onConnStatus((status) => {
      if (status === 'error') setError('Connection failed. Check your AWS credentials and network.')
      else setError(null)
    })
    const unsubKeypairs = window.cloudblocks.onScanKeypairs((pairs: string[]) => {
      useCloudStore.getState().setKeyPairs(pairs)
    })
    return () => { unsubDelta(); unsubStatus(); unsubConn(); unsubKeypairs() }
  }, [applyDelta, setScanStatus, setError])
}
