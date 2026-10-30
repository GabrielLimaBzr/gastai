'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTransactions } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { merchantOf } from '@/lib/anomalies'
import { DEFAULT_NAMES, effectiveCategory } from '@/lib/categorize'
import { downloadCsv, toCsv } from '@/lib/exportCsv'
import { brl } from '@/lib/money'

const NEW = '__new__'

export default function Transactions() {
  const supabase = createClient()
  const { rows, setRows, loading, reload } = useTransactions()
  const { cats, ensure, saveRule } = useCategories()
  const [q, setQ] = useState('')
  const [applyAll, setApplyAll] = useState(true)
  const [msg, setMsg] = useState('')

  const nameById = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])
  const catOf = (r: (typeof rows)[number]) => effectiveCategory(r.description, r.category_id && nameById.get(r.category_id))
  const options = useMemo(() => [...new Set([...DEFAULT_NAMES, ...cats.map((c) => c.name)])], [cats])
  const list = rows.filter((r) => r.description.toLowerCase().includes(q.toLowerCase()))

  async function change(tx: (typeof rows)[number], value: string) {
    let name = value
    if (value === NEW) {
      name = (prompt('Nome da nova categoria:') ?? '').trim()
      if (!name) return
    }
    try {
      const categoryId = await ensure(name)
      const m = merchantOf(tx.description)
      const ids = (applyAll ? rows.filter((r) => merchantOf(r.description) === m) : [tx]).map((r) => r.id)
      const idSet = new Set(ids)
      setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, category_id: categoryId } : r))) // atualiza na hora
      const { error } = await supabase.from('transactions').update({ category_id: categoryId }).in('id', ids)
      if (error) throw error
      if (applyAll) await saveRule(tx.description, categoryId)
      setMsg(`${ids.length} lançamento(s) → ${name}`)
    } catch (e) {
      setMsg(`Não salvou: ${(e as Error).message}`)
      reload()
    }
  }

  function exportCsv() {
    const csv = toCsv(list.map((r) => ({ ...r, category: catOf(r) })))
    downloadCsv(`gastai-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input flex-1" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          Aplicar a todos do mesmo estabelecimento
        </label>
        <button className="btn" onClick={exportCsv} disabled={!list.length}>Exportar CSV ({list.length})</button>
      </div>
      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {loading ? <p className="text-zinc-500">Carregando…</p> : (
        <div className="card divide-y divide-zinc-800 p-0">
          {list.slice(0, 300).map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="hidden w-24 shrink-0 text-zinc-500 sm:block">{r.occurred_on}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.description}
                {r.installment_total ? <span className="ml-2 text-zinc-500">{r.installment_no}/{r.installment_total}</span> : null}
              </span>
              <select className="input w-44 shrink-0 py-1" value={catOf(r)} onChange={(e) => change(r, e.target.value)}>
                {options.map((n) => <option key={n}>{n}</option>)}
                <option value={NEW}>＋ Nova categoria…</option>
              </select>
              <span className={`w-24 shrink-0 text-right ${r.amount_cents < 0 ? 'text-emerald-400' : ''}`}>{brl(r.amount_cents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
