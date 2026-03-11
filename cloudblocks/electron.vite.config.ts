import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: { lib: { entry: 'src/main/index.ts' } },
  },
  preload: {
    build: { lib: { entry: 'src/preload/index.ts' } },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
  },
})
