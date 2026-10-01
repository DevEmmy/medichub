import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { db } from './lib/store'
import { buildSeed, ensureSlots } from './data/seed'
import App from './App'
import { startReminderScheduler } from './services/reminders'

db.init(buildSeed, ensureSlots)
startReminderScheduler()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
