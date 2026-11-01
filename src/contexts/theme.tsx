'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { setPaletteMode, type Mode } from '@/lib/palette'

export type ThemePref = 'system' | 'light' | 'dark'
const KEY = 'gastai:theme'
const META = { dark: '#0c1117', light: '#f3f5f7' } as const

const Ctx = createContext<{ pref: ThemePref; resolved: Mode; setPref: (p: ThemePref) => void }>({ pref: 'system', resolved: 'dark', setPref: () => {} })
export const useTheme = () => useContext(Ctx)

const systemMode = (): Mode => (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
const resolve = (p: ThemePref): Mode => (p === 'system' ? systemMode() : p)

/** Script que roda antes da pintura: define o tema do <html> sem "piscar" o tema errado. */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='dark'}})()`

/**
 * Tema claro / escuro / automático (segue o aparelho). A paleta dos gráficos é uma variável de módulo, então a
 * árvore é remontada (`key`) quando o tema muda: assim toda cor calculada em JS é recalculada.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system')
  const [resolved, setResolved] = useState<Mode>(() => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'))
  setPaletteMode(resolved) // síncrono: precisa valer antes de os filhos renderizarem

  useEffect(() => {
    try { const v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v) } catch { /* sem storage */ }
  }, [])

  useEffect(() => {
    const apply = () => {
      const r = resolve(pref)
      document.documentElement.dataset.theme = r
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', META[r]))
      setResolved(r)
    }
    apply()
    if (pref !== 'system') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [pref])

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p)
    try { localStorage.setItem(KEY, p) } catch { /* sem storage */ }
  }, [])

  return (
    <Ctx.Provider value={{ pref, resolved, setPref }}>
      <div key={resolved} className="contents">{children}</div>
    </Ctx.Provider>
  )
}
