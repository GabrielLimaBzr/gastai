'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Total parcial da fatura em aberto de cada cartão em um mês (AAAA-MM). */
export function useCardEstimates(ym: string) {
  const supabase = createClient()
  const [byCard, setByCard] = useState<Record<string, number>>({})
  const load = useCallback(async () => {
    if (!ym) return
    const { data } = await supabase.from('card_estimates').select('account_id,amount_cents').eq('month', `${ym}-01`)
    setByCard(Object.fromEntries((data ?? []).map((r) => [r.account_id as string, r.amount_cents as number])))
  }, [ym]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function set(accountId: string, cents: number) {
    const { error } = await supabase.from('card_estimates')
      .upsert({ account_id: accountId, month: `${ym}-01`, amount_cents: cents, updated_at: new Date().toISOString() }, { onConflict: 'user_id,account_id,month' })
    if (error) throw error
    setByCard((p) => ({ ...p, [accountId]: cents }))
  }
  async function clear(accountId: string) {
    const { error } = await supabase.from('card_estimates').delete().eq('account_id', accountId).eq('month', `${ym}-01`)
    if (error) throw error
    setByCard((p) => { const n = { ...p }; delete n[accountId]; return n })
  }
  return { byCard, set, clear, reload: load }
}
