import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { BridgeMock } from '@bridgelauncher/api-mock'

// Only mock when not injected by the real launcher
if (!window.Bridge) {
  window.Bridge = new BridgeMock({
    // Optional: point to a mock apps.json if you exported one
    // appsUrl: '/mock/apps.json',
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
