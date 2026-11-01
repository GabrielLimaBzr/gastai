'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { billAmount, billsForMonth, billsTotal, type BillAmount } from '@/lib/bills'

export interface Bill { id: string; name: string; expected_cents: number; due_day: number; variable: boolean }

/** Contas fixas e variáveis, com o valor de cada mês (contas variáveis têm um valor por mês). */
export function useBills() {
  const supabase = createClient()
  const [bills, setBills] = useState<Bill[]>([])
  const [amounts, setAmounts] = useState<BillAmount[]>([])
  const [ready, setReady] = useState(false)

  const reload = useCallback(async () => {
    const [b, a] = await Promise.all([
      supabase.from('recurring_bills').select('id,name,expected_cents,due_day,variable').eq('active', true).order('due_day'),
      supabase.from('bill_amounts').select('bill_id,month,amount_cents'),
    ])
    setBills((b.data as Bill[]) ?? [])
    setAmounts((a.data as BillAmount[]) ?? [])
    setReady(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload])

  /** Informa o valor real de uma conta variável em um mês (AAAA-MM). */
  async function setAmount(billId: string, ym: string, cents: number) {
    const { data, error } = await supabase.from('bill_amounts')
      .upsert({ bill_id: billId, month: `${ym}-01`, amount_cents: cents }, { onConflict: 'user_id,bill_id,month' })
      .select('bill_id,month,amount_cents').single()
    if (error) throw error
    setAmounts((p) => [...p.filter((x) => !(x.bill_id === billId && x.month.slice(0, 7) === ym)), data as BillAmount])
  }

  return {
    bills, amounts, ready, reload, setAmount,
    amountFor: (b: Bill, ym: string) => billAmount(b, ym, amounts),
    fixedFor: (ym: string) => billsTotal(bills, ym, amounts),
    forMonth: (ym: string) => billsForMonth(bills, ym, amounts),
  }
}
