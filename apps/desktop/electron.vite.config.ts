import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// @riftview/shared is a workspace package that ships unbuilt TS source
// (main: src/index.ts). Electron's Node 22.22 strip-types loads it as ESM,
// which rejects the extensionless relative imports. Bundle it instead.
const bundleShared = { externalizeDeps: { exclude: ['@riftview/shared', '@riftview/cloud-scan'] } }

export default defineConfig({
  main: {
    build: { ...bundleShared, lib: { entry: 'src/main/index.ts' } }
  },
  preload: {
    build: { ...bundleShared, lib: { entry: 'src/preload/index.ts' } }
  },
  renderer: {
    plugins: [react(), tailwindcss()]
  }
})
