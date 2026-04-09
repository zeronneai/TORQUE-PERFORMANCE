import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes'; // <--- ESTA LÍNEA FALTA

// ... resto del código
<ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={{ baseTheme: dark }}>
  <App />
</ClerkProvider>

// Aquí pegas tu clave de Clerk (la que empieza con pk_test_)
const PUBLISHABLE_KEY = "pk_test_YnJpZWYtcm9kZW50LTQ1LmNsZXJrLmFjY291bnRzLmRldiQ" 

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={{ baseTheme: dark }}>
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
