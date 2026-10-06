import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Noto Sans Thai (Google font), bundled with the app so no request goes to Google.
import '@fontsource-variable/noto-sans-thai'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
