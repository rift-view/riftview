// Rift design system — order matters.
// Fonts are injected as @font-face via fontsource packages.
import '@fontsource/archivo-narrow/400.css'
import '@fontsource/archivo-narrow/600.css'
import '@fontsource/archivo-narrow/700.css'
import '@fontsource-variable/libre-franklin'
import '@fontsource/fragment-mono'

// Rift tokens + motion + primitives.
import '../styles/tokens.css'
import '../styles/motion.css'
import '../styles/primitives.css'

// Existing styles (kept through R7; removed in R8).
import './assets/main.css'
import '../styles/themes.css'

// Compat shim — must load last so --cb-* aliases beat themes.css.
// Deleted at the end of R3.
import '../styles/compat.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
