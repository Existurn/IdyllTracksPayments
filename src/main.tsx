import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RBACProvider } from './contexts/RBACContext'
import { KeyboardShortcutProvider } from './contexts/KeyboardShortcutContext'
import { ThemeProvider } from './contexts/ThemeContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RBACProvider>
        <KeyboardShortcutProvider>
          <App />
        </KeyboardShortcutProvider>
      </RBACProvider>
    </ThemeProvider>
  </StrictMode>,
)
