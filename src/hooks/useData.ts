'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface TxRow {
  id: string
  occurred_on: string
  description: string
  amount_cents: number
  installment_no: number | null
  installment_total: number | null
  category_id: string | null
}

/** Carrega todas as transações do usuário (RLS filtra). Para uso pessoal o volume cabe em memória. */
export function useTransactions() {
  const supabase = createClient()
  const [rows, setRows] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('id,occurred_on,description,amount_cents,installment_no,installment_total,category_id')
      .order('occurred_on', { ascending: false })
      .limit(5000)
    setRows((data as TxRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])
  return { rows, loading, reload }
}
