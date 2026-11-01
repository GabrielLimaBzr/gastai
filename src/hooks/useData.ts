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
  billed_month: string | null
  account_id: string | null
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
      .select('id,occurred_on,description,amount_cents,installment_no,installment_total,category_id,billed_month,account_id')
      .order('occurred_on', { ascending: false })
      .limit(5000)
    setRows((data as TxRow[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])
  return { rows, setRows, loading, reload }
}

export interface Account { id: string; name: string; created_at: string; color: string | null; due_day: number | null }

/** Cartões do usuário, na ordem de criação (a cor de cada cartão nos gráficos segue essa ordem). */
export function useAccountsFull() {
  const supabase = createClient()
  const [accounts, setAccounts] = useState<Account[]>([])
  const reload = useCallback(async () => {
    const { data } = await supabase.from('accounts').select('id,name,created_at,color,due_day').order('created_at')
    setAccounts((data as Account[]) ?? [])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload() }, [reload])

  /** Dia do mês em que a fatura do cartão vence (null apaga). */
  async function setDueDay(id: string, day: number | null) {
    const { error } = await supabase.from('accounts').update({ due_day: day }).eq('id', id)
    if (error) throw error
    setAccounts((p) => p.map((a) => (a.id === id ? { ...a, due_day: day } : a)))
  }
  return { accounts, reload, setDueDay }
}

export const useAccounts = () => useAccountsFull().accounts
