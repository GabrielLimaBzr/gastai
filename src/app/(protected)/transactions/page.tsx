'use client'
import { useState } from 'react'
import { useTransactions } from '@/hooks/useData'
import { brl } from '@/lib/money'

export default function Transactions() {
  const { rows, loading } = useTransactions()
  const [q, setQ] = useState('')
  const list = rows.filter((r) => r.description.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-3">
      <input className="input" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      {loading ? <p className="text-zinc-500">Carregando…</p> : (
        <div className="card divide-y divide-zinc-800 p-0">
          {list.slice(0, 300).map((r) => (
            <div key={r.id} className="flex justify-between gap-4 px-4 py-2 text-sm">
              <span className="w-24 shrink-0 text-zinc-500">{r.occurred_on}</span>
              <span className="flex-1 truncate">
                {r.description}
                {r.installment_total ? <span className="ml-2 text-zinc-500">{r.installment_no}/{r.installment_total}</span> : null}
              </span>
              <span className={r.amount_cents < 0 ? 'text-emerald-400' : ''}>{brl(r.amount_cents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
