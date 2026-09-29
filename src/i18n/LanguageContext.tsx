import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DICTS, EN, LANGUAGES, type Key, type Lang } from './strings'

interface Api { lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string; langName: string }
const Ctx = createContext<Api>({ lang: 'en', setLang: () => {}, t: (k) => EN[k], langName: 'English' })
const KEY = 'medichub.lang'

function initial(): Lang {
  try { const v = localStorage.getItem(KEY) as Lang | null; if (v && v in DICTS) return v } catch { /* ignore */ }
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial)
  const setLang = useCallback((l: Lang) => { setLangState(l); try { localStorage.setItem(KEY, l) } catch { /* ignore */ } }, [])
  useEffect(() => { document.documentElement.lang = lang === 'pcm' ? 'pcm' : lang }, [lang])
  const t = useCallback((k: Key) => DICTS[lang][k] ?? EN[k], [lang])
  return <Ctx.Provider value={{ lang, setLang, t, langName: LANGUAGES.find((x) => x.code === lang)!.name }}>{children}</Ctx.Provider>
}
export const useT = () => useContext(Ctx)
