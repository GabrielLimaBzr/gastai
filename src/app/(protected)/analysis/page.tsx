'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAccounts, useTransactions, type TxRow } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { analyze } from '@/lib/analysis'
import { bucketBy, categorize, groupSum, merchantKey } from '@/lib/ledger'
import { brl, txMonth } from '@/lib/money'
import { monthLabel } from '@/components/charts'
import { cardStyle } from '@/lib/cards'
import { createClient } from '@/lib/supabase/client'
import { useSharedMonth } from '@/contexts/month'

const CUT = 0.2 // meta de corte simulada sobre o gasto flexível

type CardOf = (id: string | null) => { name: string; color: string }

/** Compras de uma linha da análise: nome, valor e de qual cartão saiu (a categoria já está na linha de cima). */
function Purchases({ items, cardOf }: { items: TxRow[]; cardOf: CardOf }) {
  const byCard = groupSum(items, (r) => r.account_id ?? '', (r) => r.amount_cents)
  return (
    <div className="mt-2">
      {byCard.length > 1 && (
        <p className="mb-2 flex flex-wrap gap-1.5 text-xs">
          {byCard.map((c) => {
            const card = cardOf(c.key || null)
            return (
              <span key={c.key} className="chip">
                <i className="inline-block size-2 shrink-0 rounded-sm" style={{ background: card.color }} aria-hidden />
                {card.name} {brl(c.cents)}
              </span>
            )
          })}
        </p>
      )}
      <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 text-sm">
        {[...items].sort((a, b) => b.amount_cents - a.amount_cents).map((r) => {
          const card = cardOf(r.account_id)
          return (
            <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate">
                  {r.description}
                  {r.installment_total ? <span className="ml-1.5 text-xs text-zinc-500">{r.installment_no}/{r.installment_total}</span> : null}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                  <span>{r.occurred_on.slice(8, 10)}/{r.occurred_on.slice(5, 7)}</span>
                  <span className="inline-flex items-center gap-1">
                    <i className="inline-block size-2 shrink-0 rounded-sm" style={{ background: card.color }} aria-hidden />
                    {card.name}
                  </span>
                </span>
              </span>
              <span className="shrink-0 tabular-nums">{brl(r.amount_cents)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Linha que abre ao tocar: título/valor/barra em cima, lista de compras embaixo. */
function Expandable({ title, count, cents, pct, barClass, tag, children }: {
  title: string; count: number; cents: number; pct: number; barClass: string; tag?: string; children: React.ReactNode
}) {
  return (
    <details className="group py-1">
      <summary className="cursor-pointer list-none rounded-lg py-1 [&::-webkit-details-marker]:hidden">
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="flex min-w-0 items-baseline gap-1">
            <ChevronRight size={14} className="shrink-0 self-center text-zinc-500 transition-transform group-open:rotate-90" aria-hidden />
            <span className="min-w-0 break-words">{title}</span>
            <span className="shrink-0 text-xs text-zinc-500">{count}x</span>
            {tag && <span className="ml-1 shrink-0 rounded bg-amber-500/20 px-1.5 text-xs text-amber-300">{tag}</span>}
          </span>
          <span className="shrink-0 tabular-nums">{brl(cents)} <span className="text-xs text-zinc-500">{(pct * 100).toFixed(0)}%</span></span>
        </span>
        <span className="mt-1 block h-1.5 rounded bg-zinc-800">
          <span className={`block h-1.5 rounded ${barClass}`} style={{ width: `${pct * 100}%` }} />
        </span>
      </summary>
      {children}
    </details>
  )
}

export default function Analysis() {
  const { rows, loading } = useTransactions()
  const accounts = useAccounts()
  const { cats, ready } = useCategories()
  const [income, setIncome] = useState(0)

  const months = useMemo(() => [...new Set(rows.map(txMonth))].sort().reverse(), [rows])
  const [month, setMonth] = useSharedMonth(months, months[0] ?? '')

  useEffect(() => {
    if (!month) return
    createClient().from('income').select('amount_cents').eq('month', `${month}-01`)
      .then(({ data }) => setIncome((data ?? []).reduce((s, r) => s + r.amount_cents, 0)))
  }, [month])

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])
  const chosen = (r: { category_id?: string | null }) => (r.category_id ? catName.get(r.category_id) : null)

  // mesma cor de cada cartão do Resumo (ordem de criação)
  const cardOf: CardOf = (id) => cardStyle(accounts, id)

  const view = useMemo(() => {
    const spent = rows.filter((r) => txMonth(r) === month && r.amount_cents > 0)
    const a = analyze(spent, (t) => chosen(t as TxRow))
    const byCategory = bucketBy(spent, (r) => categorize(r.description, chosen(r)).name)
    const byMerchant = bucketBy(spent, (r) => merchantKey(r.description))
    const top = groupSum(spent, (r) => merchantKey(r.description), (r) => r.amount_cents).slice(0, 10)
    return { a, byCategory, byMerchant, top }
  }, [rows, month, catName]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !ready) return <p className="text-zinc-500">Carregando…</p>
  if (!months.length) return <p className="text-zinc-400">Importe uma fatura para ver a análise.</p>

  const { a } = view
  const saving = Math.round(a.flexibleTotal * CUT)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Para onde vai o dinheiro</h1>
        <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês da fatura">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="card">
        <p className="text-sm text-zinc-400">Total no mês</p>
        <p className="text-3xl tabular-nums">{brl(a.total)}</p>
        {income > 0 && <p className="text-xs text-zinc-400">{((a.total / income) * 100).toFixed(0)}% da renda</p>}
      </div>

      <div className="card">
        <h2 className="font-medium">Por categoria</h2>
        <p className="mb-2 text-xs text-zinc-500">Toque numa linha para ver as compras e de qual cartão saíram.</p>
        <div className="divide-y divide-zinc-800/60">
          {a.byCategory.map((c) => (
            <Expandable key={c.name} title={c.name} count={c.count} cents={c.cents} pct={c.pct}
              tag={c.flex === 'flexible' ? 'cortável' : undefined}
              barClass={c.flex === 'flexible' ? 'bg-amber-400' : 'bg-emerald-500'}>
              <Purchases items={view.byCategory.get(c.name) ?? []} cardOf={cardOf} />
            </Expandable>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-medium">Maiores estabelecimentos</h2>
        <p className="mb-2 text-xs text-zinc-500">Toque para ver cada compra feita no lugar.</p>
        <div className="divide-y divide-zinc-800/60">
          {view.top.map((m) => {
            const items = view.byMerchant.get(m.key) ?? []
            return (
              <Expandable key={m.key} title={items[0]?.description ?? m.key} count={m.count} cents={m.cents} pct={a.total ? m.cents / a.total : 0} barClass="bg-sky-500">
                <Purchases items={items} cardOf={cardOf} />
              </Expandable>
            )
          })}
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
