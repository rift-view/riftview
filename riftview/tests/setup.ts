import '@testing-library/jest-dom'
import { flushSync } from 'react-dom'
import { useCloudStore } from '../src/renderer/store/cloud'
import { useUIStore } from '../src/renderer/store/ui'
import { useCliStore } from '../src/renderer/store/cli'

// React 19 no longer synchronously flushes updates from external stores
// (zustand) when setState is called outside of React event handlers. Tests
// that mutate a store after render and then synchronously query the DOM rely
// on the update applying immediately. Wrap each store's setState with
// flushSync so those assertions hold without per-test boilerplate.
type StoreLike = { setState: (...args: never[]) => unknown }
function patchStore(store: StoreLike): void {
  const original = store.setState.bind(store) as (...args: unknown[]) => unknown
  store.setState = ((...args: unknown[]) => {
    let result: unknown
    flushSync(() => {
      result = original(...args)
    })
    return result
  }) as unknown as typeof store.setState
}
patchStore(useCloudStore as unknown as StoreLike)
patchStore(useUIStore as unknown as StoreLike)
patchStore(useCliStore as unknown as StoreLike)
