'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Payment { id: string; kind: 'card' | 'bill'; ref_id: string; month: string; paid_on: string; amount_cents: number | null }

/** AAAA-MM-DD no fuso do aparelho (não em UTC, para não pular de dia à noite). */
export const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Pagamentos marcados no calendário. */
export function usePayments() {
  const supabase = createClient()
  const [list, setList] = useState<Payment[]>([])
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('payments').select('id,kind,ref_id,month,paid_on,amount_cents').order('paid_on', { ascending: false })
    setList((data as Payment[]) ?? [])
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const find = (kind: 'card' | 'bill', ref: string, ym: string) =>
    list.find((p) => p.kind === kind && p.ref_id === ref && p.month.slice(0, 7) === ym)

  async function markPaid(kind: 'card' | 'bill', ref: string, ym: string, cents: number | null) {
    const { data, error } = await supabase.from('payments')
      .insert({ kind, ref_id: ref, month: `${ym}-01`, paid_on: localISO(), amount_cents: cents })
      .select('id,kind,ref_id,month,paid_on,amount_cents').single()
    if (error) throw error
    setList((p) => [data as Payment, ...p])
  }

  async function unmark(id: string) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) throw error
    setList((p) => p.filter((x) => x.id !== id))
  }

  return { list, ready, find, markPaid, unmark }
}
