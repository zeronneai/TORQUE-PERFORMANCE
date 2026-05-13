import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { Capacitor } from '@capacitor/core'

const PUBLISHABLE_KEY = "pk_test_YnJpZWYtcm9kZW50LTQ1LmNsZXJrLmFjY291bnRzLmRldiQ"

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => { window.location.hash = to }}
      routerReplace={(to) => { window.location.hash = to }}
      appearance={{ baseTheme: dark }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)

// Service Worker: web only (Capacitor native uses bundled assets)
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
