'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTransactions } from '@/hooks/useData'
import { brl, monthKey } from '@/lib/money'

export default function Dashboard() {
  const supabase = createClient()
  const { rows, loading } = useTransactions()
  const [income, setIncome] = useState<Record<string, number>>({})

  useEffect(() => {
    supabase.from('income').select('month,amount_cents').then(({ data }) => {
      const m: Record<string, number> = {}
      for (const r of data ?? []) m[monthKey(r.month)] = (m[monthKey(r.month)] ?? 0) + r.amount_cents
      setIncome(m)
    })
  }, [])

  const months = useMemo(() => {
    const spent: Record<string, number> = {}
    for (const r of rows) spent[monthKey(r.occurred_on)] = (spent[monthKey(r.occurred_on)] ?? 0) + r.amount_cents
    return Object.keys({ ...spent, ...income }).sort().reverse().map((m) => ({ m, spent: spent[m] ?? 0, inc: income[m] ?? 0 }))
  }, [rows, income])

  async function setIncomeFor(month: string) {
    const v = prompt(`Renda líquida de ${month} (R$):`)
    if (!v) return
    const cents = Math.round(parseFloat(v.replace(/\./g, '').replace(',', '.')) * 100)
    await supabase.from('income').upsert({ source: 'Total', month: `${month}-01`, amount_cents: cents }, { onConflict: 'user_id,source,month' })
    setIncome((p) => ({ ...p, [month]: cents }))
  }

  if (loading) return <p className="text-zinc-500">Carregando…</p>
  if (!months.length) return <p className="text-zinc-400">Nenhum dado ainda. Comece em <b>Importar</b>.</p>

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Renda vs gastos</h1>
      {months.map(({ m, spent, inc }) => {
        const pct = inc ? Math.min(100, (spent / inc) * 100) : 0
        const over = inc > 0 && spent > inc
        return (
          <div key={m} className="card">
            <div className="flex items-baseline justify-between">
              <span className="font-medium">{m}</span>
              <button className="text-xs text-zinc-500 hover:text-white" onClick={() => setIncomeFor(m)}>
                {inc ? `renda ${brl(inc)}` : 'definir renda'}
              </button>
            </div>
            <p className="mt-1 text-2xl">{brl(spent)}</p>
            {inc > 0 && (
              <>
                <div className="mt-2 h-2 rounded bg-zinc-800">
                  <div className={`h-2 rounded ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {pct.toFixed(0)}% da renda · {over ? 'estourou' : 'sobra'} {brl(Math.abs(inc - spent))}
                </p>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
