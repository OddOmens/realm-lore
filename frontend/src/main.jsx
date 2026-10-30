import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import SignIn from './components/SignIn.jsx'
import { initPrefs } from './lib/prefs.js'

const root = createRoot(document.getElementById('root'))

async function start() {
  const auth = await fetch('/api/auth/status').then(r => r.json()).catch(() => ({ authenticated: false, unreachable: true }))
  if (!auth.authenticated) {
    root.render(<SignIn unreachable={auth.unreachable} onSignedIn={start} />)
    return
  }
  // Preferences load before the app does: some stores read them at import time.
  await initPrefs()
  const { default: App } = await import('./App.jsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

start()
