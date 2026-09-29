import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { db } from './lib/store'
import { buildSeed, ensureSlots } from './data/seed'
import App from './App'

db.init(buildSeed, ensureSlots)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
