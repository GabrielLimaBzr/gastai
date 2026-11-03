'use client'
import { useCallback, useEffect, useState } from 'react'
import { useDialogs } from '@/contexts/dialogs'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/money'
import { monthLabel } from '@/components/charts'
import { friendlyError } from '@/lib/errors'

interface Stmt {
  id: string
  account_id: string
  reference_month: string
  total_cents: number | null
  transactions: { count: number }[]
  sample: string[]
}

/** Faturas já importadas: dá para trocar o cartão (se foi gravada no errado) ou excluir para importar de novo. */
export function ImportedStatements({ accounts, reloadKey, onChanged }: {
  accounts: { id: string; name: string }[]
  reloadKey: number
  onChanged: () => void
}) {
  const supabase = createClient()
  const { confirm } = useDialogs()
  const [list, setList] = useState<Stmt[]>([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('statements')
      .select('id,account_id,reference_month,total_cents,transactions(count)')
      .order('reference_month', { ascending: false })
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as Omit<Stmt, 'sample'>[]
    // 3 compras de exemplo ajudam a reconhecer de qual banco é a fatura
    const samples = await Promise.all(rows.map((s) =>
      supabase.from('transactions').select('description').eq('statement_id', s.id).limit(3).then(({ data: d }) => (d ?? []).map((r) => r.description as string))))
    setList(rows.map((s, i) => ({ ...s, sample: samples[i] })))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load, reloadKey])

  async function move(s: Stmt, accountId: string) {
    setBusy(s.id); setMsg('')
    const a = await supabase.from('statements').update({ account_id: accountId }).eq('id', s.id)
    const b = a.error ? a : await supabase.from('transactions').update({ account_id: accountId }).eq('statement_id', s.id)
    setBusy('')
    if (b.error) return setMsg(friendlyError(b.error, 'trocar o cartão desta fatura'))
    setMsg(`Fatura movida para «${accounts.find((x) => x.id === accountId)?.name}».`)
    await load(); onChanged()
  }

  async function remove(s: Stmt) {
    const n = s.transactions[0]?.count ?? 0
    if (!(await confirm({ title: 'Excluir esta fatura?', description: `As ${n} compras dela também serão excluídas. Depois você pode importar o arquivo de novo.`, confirmLabel: 'Excluir', danger: true }))) return
    setBusy(s.id); setMsg('')
    const { error } = await supabase.from('statements').delete().eq('id', s.id)
    setBusy('')
    if (error) return setMsg(friendlyError(error, 'excluir a fatura'))
    setMsg('Fatura excluída.')
    await load(); onChanged()
  }

  if (!list.length) {
    // depois de excluir a última fatura ainda mostramos o aviso, em vez de sumir sem explicação
    return msg ? <p className="text-sm text-emerald-400" role="status">{msg}</p> : null
  }
  return (
    <div className="card">
      <h2 className="font-medium">Faturas importadas</h2>
      <p className="mb-3 text-xs text-zinc-500">Importou no cartão errado? Troque o cartão aqui, as compras acompanham. Ou exclua a fatura e importe de novo.</p>
      {msg && <p className="mb-2 text-sm text-emerald-400" role="status">{msg}</p>}
      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-800 p-3">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <b>{monthLabel(s.reference_month.slice(0, 7))}</b>
              <span className="tabular-nums">{s.total_cents != null ? brl(s.total_cents) : '—'} <span className="text-xs text-zinc-500">· {s.transactions[0]?.count ?? 0} compras</span></span>
            </div>
            <p className="mt-1 truncate text-xs text-zinc-500">ex.: {s.sample.join(' · ') || '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-zinc-400">Cartão
                <select className="input py-1.5" value={s.account_id} disabled={busy === s.id} onChange={(e) => move(s, e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <button className="btn-ghost text-red-300" disabled={busy === s.id} onClick={() => remove(s)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
