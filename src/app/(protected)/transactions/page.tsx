'use client'
import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts, useTransactions, type TxRow } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { DEFAULT_NAMES } from '@/lib/categorize'
import { categorize, groupSum, merchantKey, monthsDesc, sumCents, type CatState } from '@/lib/ledger'
import { downloadCsv, toCsv } from '@/lib/exportCsv'
import { brl, txMonth } from '@/lib/money'
import { monthLabel } from '@/components/charts'
import { friendlyError } from '@/lib/errors'

type Status = 'all' | CatState
type View = 'rows' | 'groups'
const NEW = '__new__'

const STATUS: { id: Status; label: string; hint: string }[] = [
  { id: 'all', label: 'Todas', hint: '' },
  { id: 'none', label: 'Sem categoria', hint: 'nenhuma pista' },
  { id: 'suggested', label: 'Sugeridas', hint: 'palpite automático' },
  { id: 'confirmed', label: 'Confirmadas', hint: 'você escolheu' },
]

function StateIcon({ state }: { state: CatState }) {
  if (state === 'confirmed') return <Check size={14} className="shrink-0 text-emerald-400" aria-label="Categoria confirmada" />
  if (state === 'suggested') return <Sparkles size={14} className="shrink-0 text-zinc-500" aria-label="Categoria sugerida" />
  return <AlertCircle size={14} className="shrink-0 text-amber-400" aria-label="Sem categoria" />
}

function CategorySelect({ name, state, options, onChange }: { name: string; state: CatState; options: string[]; onChange: (v: string) => void }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StateIcon state={state} />
      <select
        className={`input py-1.5 ${state === 'none' ? 'border-amber-500/60' : ''}`}
        value={state === 'none' ? '' : name}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Categoria"
      >
        {state === 'none' && <option value="" disabled>Escolher categoria…</option>}
        {options.map((n) => <option key={n}>{n}</option>)}
        <option value={NEW}>＋ Nova categoria…</option>
      </select>
    </span>
  )
}

export default function Transactions() {
  const supabase = createClient()
  const { rows, setRows, loading, reload } = useTransactions()
  const accounts = useAccounts()
  const { cats, ready, ensure, saveRule } = useCategories()

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [view, setView] = useState<View>('rows')
  const [month, setMonth] = useState('all')
  const [card, setCard] = useState('all')
  const [applyAll, setApplyAll] = useState(true)
  const [limit, setLimit] = useState(100)
  const [msg, setMsg] = useState('')

  // links do Resumo: /transactions?filtro=sem-categoria&mes=2026-10
  useEffect(() => {
    const p = new URLSearchParams(location.search)
    if (p.get('filtro') === 'sem-categoria') { setStatus('none'); setView('groups') }
    if (p.get('mes')) setMonth(p.get('mes')!)
  }, [])

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])
  const cardName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const options = useMemo(() => [...new Set([...DEFAULT_NAMES, ...cats.map((c) => c.name)])], [cats])
  const info = (r: TxRow) => categorize(r.description, r.category_id ? catName.get(r.category_id) : null)
  const months = useMemo(() => monthsDesc(rows), [rows])

  // 1) filtros de contexto (mês, cartão, busca) — os contadores abaixo respeitam estes
  const base = useMemo(() => rows.filter((r) =>
    (month === 'all' || txMonth(r) === month) &&
    (card === 'all' || (card === 'none' ? !r.account_id : r.account_id === card)) &&
    r.description.toLowerCase().includes(q.toLowerCase())), [rows, month, card, q])
  const counts = useMemo(() => {
    const c = { all: base.length, none: 0, suggested: 0, confirmed: 0 }
    for (const r of base) c[info(r).state]++
    return c
  }, [base, catName]) // eslint-disable-line react-hooks/exhaustive-deps
  // 2) filtro de status
  const list = useMemo(() => (status === 'all' ? base : base.filter((r) => info(r).state === status)), [base, status, catName]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const g = new Map<string, TxRow[]>()
    for (const r of list) g.set(merchantKey(r.description), [...(g.get(merchantKey(r.description)) ?? []), r])
    return [...g.entries()].map(([key, items]) => ({ key, items, cents: sumCents(items), state: items.map(info).sort((a, b) => ({ none: 0, suggested: 1, confirmed: 2 })[a.state] - ({ none: 0, suggested: 1, confirmed: 2 })[b.state])[0] }))
      .sort((a, b) => b.cents - a.cents)
  }, [list, catName]) // eslint-disable-line react-hooks/exhaustive-deps

  async function assign(targets: TxRow[], value: string, rule: boolean) {
    let name = value
    if (value === NEW) {
      name = (prompt('Nome da nova categoria:') ?? '').trim()
      if (!name) return
    }
    try {
      const categoryId = await ensure(name)
      const ids = new Set(targets.map((t) => t.id))
      setRows((prev) => prev.map((r) => (ids.has(r.id) ? { ...r, category_id: categoryId } : r))) // atualiza na hora
      const { error } = await supabase.from('transactions').update({ category_id: categoryId }).in('id', [...ids])
      if (error) throw error
      if (rule) await saveRule(targets[0].description, categoryId)
      setMsg(`${ids.size} compra(s) → ${name}${rule ? ' · regra salva para as próximas importações' : ''}`)
    } catch (e) {
      setMsg(friendlyError(e, 'salvar a categoria'))
      reload()
    }
  }

  /** Aceita de uma vez todos os palpites automáticos visíveis. */
  async function confirmSuggested() {
    const sugg = base.filter((r) => info(r).state === 'suggested')
    const byName = new Map<string, TxRow[]>()
    for (const r of sugg) byName.set(info(r).name, [...(byName.get(info(r).name) ?? []), r])
    for (const [name, items] of byName) await assign(items, name, false)
    setMsg(`${sugg.length} sugestões confirmadas`)
  }

  function exportCsv() {
    downloadCsv(`gastai-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(list.map((r) => ({ ...r, category: info(r).name }))))
  }

  if (loading || !ready) return <p className="text-zinc-500">Carregando…</p>

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold">Transações</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cada linha é uma compra das faturas importadas. Trocar a categoria salva na hora.{' '}
          <span className="whitespace-nowrap"><Check size={12} className="inline text-emerald-400" /> confirmada</span> ·{' '}
          <span className="whitespace-nowrap"><Sparkles size={12} className="inline" /> sugerida (palpite do app)</span> ·{' '}
          <span className="whitespace-nowrap"><AlertCircle size={12} className="inline text-amber-400" /> sem categoria</span>
        </p>
      </div>

      {/* filtros */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_10rem_12rem]">
        <input className="input col-span-2 md:col-span-1" placeholder="Buscar compra…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês da fatura">
          <option value="all">Todos os meses</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select className="input" value={card} onChange={(e) => setCard(e.target.value)} aria-label="Cartão">
          <option value="all">Todos os cartões</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          {rows.some((r) => !r.account_id) && <option value="none">Sem cartão</option>}
        </select>
      </div>

      {/* status: o contador mostra o que falta categorizar */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado da categoria">
        {STATUS.map((s) => (
          <button key={s.id} role="tab" aria-selected={status === s.id} onClick={() => setStatus(s.id)} title={s.hint}
            className={`rounded-full border px-3 py-1.5 text-sm ${status === s.id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300' : 'border-zinc-700 text-zinc-400'} ${s.id === 'none' && counts.none ? 'font-medium' : ''}`}>
            {s.label} <span className={s.id === 'none' && counts.none ? 'text-amber-400' : 'text-zinc-500'}>{counts[s.id]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-zinc-700 p-0.5 text-sm" role="group" aria-label="Modo de exibição">
          {([['rows', 'Por compra'], ['groups', 'Por estabelecimento']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} className={`rounded-md px-3 py-1 ${view === id ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>{label}</button>
          ))}
        </div>
        {counts.suggested > 0 && <button className="btn-ghost" onClick={confirmSuggested}><Sparkles size={14} /> Confirmar {counts.suggested} sugeridas</button>}
        <button className="btn-ghost ml-auto" onClick={exportCsv} disabled={!list.length}>Exportar CSV</button>
      </div>
      {view === 'groups' && <p className="text-xs text-zinc-500">Agrupa as compras do mesmo lugar: escolher a categoria uma vez vale para todas e vira regra para as próximas faturas.</p>}
      {view === 'rows' && (
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          Ao trocar, aplicar a todas as compras do mesmo estabelecimento
        </label>
      )}
      {msg && <p className="text-sm text-emerald-400" role="status">{msg}</p>}

      {!list.length ? (
        <p className="card text-sm text-zinc-400">{status === 'none' ? 'Tudo categorizado por aqui. ✓' : 'Nada encontrado com esses filtros.'}</p>
      ) : view === 'groups' ? (
        <ul className="card divide-y divide-zinc-800 p-0">
          {groups.slice(0, limit).map((g) => (
            <li key={g.key} className="space-y-2 px-4 py-3 md:grid md:grid-cols-[1fr_6rem_14rem] md:items-center md:gap-3 md:space-y-0">
              <div className="flex items-baseline justify-between gap-3 md:block">
                <span className="min-w-0 truncate font-medium md:block" title={g.items[0].description}>{g.items[0].description}</span>
                <span className="shrink-0 text-xs text-zinc-500">{g.items.length} compra(s)</span>
              </div>
              <span className="block text-sm tabular-nums md:text-right">{brl(g.cents)}</span>
              <CategorySelect name={g.state.name} state={g.state.state} options={options}
                onChange={(v) => assign(rows.filter((r) => merchantKey(r.description) === g.key), v, true)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="card divide-y divide-zinc-800 p-0">
          {list.slice(0, limit).map((r) => {
            const ci = info(r)
            const targets = () => (applyAll ? rows.filter((x) => merchantKey(x.description) === merchantKey(r.description)) : [r])
            return (
              <li key={r.id} className="space-y-2 px-4 py-3 md:grid md:grid-cols-[4.5rem_1fr_7rem_14rem_6.5rem] md:items-center md:gap-3 md:space-y-0">
                <span className="hidden text-xs text-zinc-500 md:block">{r.occurred_on.slice(8, 10)}/{r.occurred_on.slice(5, 7)}</span>
                <div className="flex items-start justify-between gap-3 md:contents">
                  <span className="min-w-0 md:order-none">
                    <span className="block truncate">{r.description}{r.installment_total ? <span className="ml-1.5 text-xs text-zinc-500">{r.installment_no}/{r.installment_total}</span> : null}</span>
                    <span className="text-xs text-zinc-500 md:hidden">{r.occurred_on.slice(8, 10)}/{r.occurred_on.slice(5, 7)} · {r.account_id ? cardName.get(r.account_id) : 'sem cartão'}</span>
                  </span>
                  <span className={`shrink-0 tabular-nums md:order-last md:text-right ${r.amount_cents < 0 ? 'text-emerald-400' : ''}`}>{brl(r.amount_cents)}</span>
                </div>
                <span className="hidden truncate text-sm text-zinc-400 md:block">{r.account_id ? cardName.get(r.account_id) : 'sem cartão'}</span>
                <CategorySelect name={ci.name} state={ci.state} options={options} onChange={(v) => assign(targets(), v, applyAll)} />
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <span>{list.length} compras · {brl(sumCents(list))}</span>
        {(view === 'rows' ? list.length : groups.length) > limit && <button className="btn-ghost" onClick={() => setLimit((l) => l + 100)}>Mostrar mais</button>}
      </div>
    </div>
  )
}
