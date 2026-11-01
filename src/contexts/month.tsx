'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const KEY = 'gastai:month'
const Ctx = createContext<{ selected: string | null; set: (m: string) => void }>({ selected: null, set: () => {} })

/**
 * Mês que você está olhando, compartilhado entre as telas: se você abriu outubro no Resumo, o Calendário,
 * as Metas etc. também abrem em outubro. Fica salvo na sessão (sobrevive a recarregar a página).
 */
export function MonthProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    try { const v = sessionStorage.getItem(KEY); if (v && /^\d{4}-\d{2}$/.test(v)) setSelected(v) } catch { /* sem storage */ }
  }, [])
  const set = useCallback((m: string) => {
    setSelected(m)
    try { sessionStorage.setItem(KEY, m) } catch { /* sem storage */ }
  }, [])
  return <Ctx.Provider value={{ selected, set }}>{children}</Ctx.Provider>
}

/**
 * [mês, trocar]. Usa o mês compartilhado se ele existir entre os `available` (lista vazia = qualquer mês);
 * senão cai no `fallback` da tela (normalmente o mês mais recente com dados).
 */
export function useSharedMonth(available: string[], fallback: string): [string, (m: string) => void] {
  const { selected, set } = useContext(Ctx)
  const ok = !!selected && (available.length === 0 || available.includes(selected))
  return [ok ? selected! : fallback, set]
}
