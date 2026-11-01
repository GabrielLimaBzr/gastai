'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Facts } from '@/lib/onboarding'

/** Descobre o que o usuário já fez olhando os próprios dados (cada consulta só pergunta "existe algum?"). */
export function useOnboarding() {
  const supabase = createClient()
  const [facts, setFacts] = useState<Facts | null>(null)

  const reload = useCallback(async () => {
    const any = (q: PromiseLike<{ data: unknown[] | null }>) => q.then(({ data }) => (data?.length ?? 0) > 0)
    const [statements, categorized, income, bills, goal, payment, accounts] = await Promise.all([
      any(supabase.from('statements').select('id').limit(1)),
      any(supabase.from('transactions').select('id').not('category_id', 'is', null).limit(1)),
      any(supabase.from('income').select('id').limit(1)),
      any(supabase.from('recurring_bills').select('id').eq('active', true).limit(1)),
      any(supabase.from('categories').select('id').not('goal_cents', 'is', null).limit(1)),
      any(supabase.from('payments').select('id').limit(1)),
      supabase.from('accounts').select('id,due_day'),
    ])
    const cards = (accounts.data ?? []) as { due_day: number | null }[]
    setFacts({
      statements, categorized, income, bills, goal, payment,
      cards: cards.length, cardsMissingDueDay: cards.filter((c) => !c.due_day).length,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload])

  return { facts, reload }
}

const KEY = 'gastai:quickstart-hidden'

/** O guia foi dispensado neste aparelho? (só conveniência: localStorage com try/catch). null = ainda lendo. */
export function useGuideHidden(): [boolean | null, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState<boolean | null>(null)
  useEffect(() => { try { setHidden(localStorage.getItem(KEY) === '1') } catch { setHidden(false) } }, [])
  const set = (h: boolean) => { setHidden(h); try { localStorage.setItem(KEY, h ? '1' : '0') } catch { /* sem storage */ } }
  return [hidden, set]
}
