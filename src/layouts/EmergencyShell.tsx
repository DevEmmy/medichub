import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, House, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth, homeFor } from '../contexts/AuthContext'
import { useT } from '../i18n/LanguageContext'

/** Distraction-free frame for emergency screens. */
export function EmergencyShell({ children, back }: { children: ReactNode; back?: string }) {
  const nav = useNavigate()
  const { user, hospitalId } = useAuth()
  const { t } = useT()
  return (
    <div className="min-h-[100dvh] bg-[#FBF7F6]">
      <header className="sticky z-30 border-b border-danger-100 bg-[#FBF7F6]/90 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <button onClick={() => (back ? nav(back) : window.history.length > 1 ? nav(-1) : nav(homeFor(user?.role, hospitalId)))} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-slate-700 hover:bg-white">
            <ArrowLeft size={18} /> <span className="hidden min-[360px]:inline">{back ? 'Back' : t('em.exit')}</span>
          </button>
          <Link to={homeFor(user?.role, hospitalId)} className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-slate-700 hover:bg-white" data-testid="home-link" aria-label="Home"><House size={17} /> <span className="hidden min-[400px]:inline">Home</span></Link>
          <p className="ml-auto inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-danger-600 px-3.5 py-1.5 text-[13px] font-bold text-white"><Siren size={15} /> {t('em.mode')}</p>
        </div>
      </header>
      <motion.main id="main" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        {children}
      </motion.main>
    </div>
  )
}
