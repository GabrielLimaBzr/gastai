'use client'
import { useEffect, useMemo, useState } from 'react'
import { useTransactions } from '@/hooks/useData'
import { analyze } from '@/lib/analysis'
import { brl, txMonth } from '@/lib/money'
import { createClient } from '@/lib/supabase/client'

const CUT = 0.2 // meta de corte simulada sobre o gasto flexível

export default function Analysis() {
  const { rows, loading } = useTransactions()
  const [month, setMonth] = useState('')
  const [income, setIncome] = useState(0)

  const months = useMemo(() => [...new Set(rows.map(txMonth))].sort().reverse(), [rows])
  useEffect(() => { if (!month && months.length) setMonth(months[0]) }, [months, month])

  useEffect(() => {
    if (!month) return
    createClient().from('income').select('amount_cents').eq('month', `${month}-01`)
      .then(({ data }) => setIncome((data ?? []).reduce((s, r) => s + r.amount_cents, 0)))
  }, [month])

  const a = useMemo(() => analyze(rows.filter((r) => txMonth(r) === month)), [rows, month])

  if (loading) return <p className="text-zinc-500">Carregando…</p>
  if (!months.length) return <p className="text-zinc-400">Importe uma fatura para ver a análise.</p>

  const saving = Math.round(a.flexibleTotal * CUT)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Para onde vai o dinheiro</h1>
        <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="card">
        <p className="text-sm text-zinc-400">Total no mês</p>
        <p className="text-3xl">{brl(a.total)}</p>
        {income > 0 && <p className="text-xs text-zinc-400">{((a.total / income) * 100).toFixed(0)}% da renda</p>}
      </div>

      <div className="card space-y-2">
        <h2 className="font-medium">Por categoria</h2>
        {a.byCategory.map((c) => (
          <div key={c.name}>
            <div className="flex justify-between text-sm">
              <span>{c.name} <span className="text-zinc-500">({c.count})</span>
                {c.flex === 'flexible' && <span className="ml-2 rounded bg-amber-500/20 px-1.5 text-xs text-amber-300">cortável</span>}
              </span>
              <span>{brl(c.cents)} <span className="text-zinc-500">{(c.pct * 100).toFixed(0)}%</span></span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-zinc-800">
              <div className={`h-1.5 rounded ${c.flex === 'flexible' ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${c.pct * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="mb-2 font-medium">Maiores estabelecimentos</h2>
        <div className="divide-y divide-zinc-800 text-sm">
          {a.topMerchants.map((m) => (
            <div key={m.name} className="flex justify-between py-1.5">
              <span>{m.name} <span className="text-zinc-500">{m.count}x</span></span><span>{brl(m.cents)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card border-emerald-800">
        <h2 className="font-medium">Onde cortar</h2>
        <p className="mt-1 text-sm text-zinc-300">
          Gasto cortável este mês: <b>{brl(a.flexibleTotal)}</b>. Reduzindo {CUT * 100}% você libera{' '}
          <b className="text-emerald-400">{brl(saving)}/mês</b> ({brl(saving * 12)}/ano).
        </p>
      </div>
    </div>
  )
}
