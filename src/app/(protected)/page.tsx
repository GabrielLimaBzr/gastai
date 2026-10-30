'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts, useTransactions, type TxRow } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { HBars, SERIES, StackedColumns, monthLabel, type Series } from '@/components/charts'
import { categorize, flexibleCents, futureInstallments, groupSum, merchantKey, monthsDesc, sumCents } from '@/lib/ledger'
import { brl, monthKey, txMonth } from '@/lib/money'

const NO_CARD = '__none__'

function Tile({ label, value, sub, href, tone }: { label: string; value: string; sub?: string; href?: string; tone?: 'bad' | 'good' }) {
  const body = (
    <div className="card h-full min-w-0">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl ${tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  )
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body
}

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="card">
    <h2 className="font-medium">{title}</h2>
    {hint && <p className="mb-3 text-xs text-zinc-500">{hint}</p>}
    <div className={hint ? '' : 'mt-3'}>{children}</div>
  </section>
)

export default function Dashboard() {
  const supabase = createClient()
  const { rows, loading } = useTransactions()
  const accounts = useAccounts()
  const { cats, ready } = useCategories()
  const [income, setIncome] = useState<Record<string, number>>({})
  const [month, setMonth] = useState('')

  useEffect(() => {
    supabase.from('income').select('month,amount_cents').then(({ data }) => {
      const m: Record<string, number> = {}
      for (const r of data ?? []) m[monthKey(r.month)] = (m[monthKey(r.month)] ?? 0) + r.amount_cents
      setIncome(m)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => monthsDesc(rows), [rows])
  useEffect(() => { if (!month && months.length) setMonth(months[0]) }, [months, month])

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])
  const info = (r: TxRow) => categorize(r.description, r.category_id ? catName.get(r.category_id) : null)

  const view = useMemo(() => {
    const cur = rows.filter((r) => txMonth(r) === month)
    const total = sumCents(cur)
    const byCategory = groupSum(cur, (r) => info(r).name, (r) => r.amount_cents).filter((s) => s.cents > 0)
    const nameOfMerchant = new Map<string, string>()
    for (const r of cur) if (!nameOfMerchant.has(merchantKey(r.description))) nameOfMerchant.set(merchantKey(r.description), r.description)
    const byMerchant = groupSum(cur.filter((r) => r.amount_cents > 0), (r) => merchantKey(r.description), (r) => r.amount_cents)
    const pending = cur.filter((r) => info(r).state === 'none')
    const prevMonth = months[months.indexOf(month) + 1]
    const prevTotal = prevMonth ? sumCents(rows.filter((r) => txMonth(r) === prevMonth)) : null

    // um bloco por cartão; a cor do cartão segue a ordem de criação e nunca muda
    const cardIds = [...accounts.map((a) => a.id), ...(rows.some((r) => !r.account_id) ? [NO_CARD] : [])]
    const series: Series[] = cardIds.map((id, i) => ({
      key: id, color: id === NO_CARD ? '#71717a' : SERIES[i % SERIES.length],
      name: id === NO_CARD ? 'Sem cartão' : accounts.find((a) => a.id === id)!.name,
    }))
    const monthsAsc = [...months].reverse().slice(-12)
    const evolution: Record<string, Record<string, number>> = {}
    for (const r of rows) {
      const m = txMonth(r), k = r.account_id ?? NO_CARD
      ;(evolution[m] ??= {})[k] = (evolution[m][k] ?? 0) + r.amount_cents
    }
    const cards = series.map((s) => {
      const list = cur.filter((r) => (r.account_id ?? NO_CARD) === s.key)
      return { ...s, list, total: sumCents(list), top: groupSum(list, (r) => info(r).name, (r) => r.amount_cents).filter((x) => x.cents > 0).slice(0, 3) }
    }).filter((c) => c.list.length)

    return { cur, total, byCategory, byMerchant, nameOfMerchant, pending, prevTotal, series, monthsAsc, evolution, cards, future: futureInstallments(rows, month, 6) }
  }, [rows, month, accounts, catName, months]) // eslint-disable-line react-hooks/exhaustive-deps

  async function setIncomeFor() {
    const v = prompt(`Renda líquida de ${monthLabel(month)} (R$):`)
    if (!v) return
    const cents = Math.round(parseFloat(v.replace(/\./g, '').replace(',', '.')) * 100)
    if (Number.isNaN(cents)) return
    await supabase.from('income').upsert({ source: 'Total', month: `${month}-01`, amount_cents: cents }, { onConflict: 'user_id,source,month' })
    setIncome((p) => ({ ...p, [month]: cents }))
  }

  if (loading || !ready) return <p className="text-zinc-500">Carregando…</p>
  if (!months.length) return <p className="text-zinc-400">Nenhum dado ainda. Comece em <b>Importar</b>.</p>

  const inc = income[month] ?? 0
  const left = inc - view.total
  const flex = flexibleCents(view.byCategory)
  const futureTotal = view.future.reduce((s, f) => s + f.cents, 0)
  const delta = view.prevTotal ? (view.total - view.prevTotal) / view.prevTotal : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Resumo</h1>
        <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês da fatura">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Gasto no mês" value={brl(view.total)}
          sub={delta == null ? 'faturas de ' + monthLabel(month) : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% vs mês anterior`} />
        <button className="text-left" onClick={setIncomeFor}>
          <Tile label="Renda" value={inc ? brl(inc) : '—'} sub={inc ? `${((view.total / inc) * 100).toFixed(0)}% da renda · toque p/ editar` : 'toque para definir'} />
        </button>
        <Tile label={inc ? (left >= 0 ? 'Sobra' : 'Estouro') : 'Sobra'} value={inc ? brl(Math.abs(left)) : '—'} tone={inc ? (left >= 0 ? 'good' : 'bad') : undefined}
          sub={inc ? (left >= 0 ? 'renda − gastos' : 'gastos acima da renda') : 'defina a renda'} />
        <Tile label="Cortável" value={brl(flex)} sub={view.total ? `${((flex / view.total) * 100).toFixed(0)}% do gasto` : undefined} href="/analysis" />
      </div>

      {view.pending.length > 0 && (
        <Link href={`/transactions?filtro=sem-categoria&mes=${month}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span><b>{view.pending.length} compras sem categoria</b> ({brl(sumCents(view.pending))}) — categorize para a análise ficar correta</span>
          <span className="shrink-0 text-amber-300">Categorizar →</span>
        </Link>
      )}

      <Section title="Gasto por mês, por cartão" hint="Cada coluna é a soma das faturas do mês; a linha branca é a renda.">
        <StackedColumns months={view.monthsAsc} series={view.series} data={view.evolution} marker={Object.keys(income).length ? income : undefined} markerLabel="Renda" />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Por categoria" hint="Em reais e % do mês.">
          <HBars items={view.byCategory.slice(0, 10).map((s) => ({ key: s.key, label: s.key, cents: s.cents, count: s.count }))} />
        </Section>
        <Section title="Onde mais gasto" hint="Maiores estabelecimentos do mês.">
          <HBars items={view.byMerchant.slice(0, 10).map((s) => ({ key: s.key, label: view.nameOfMerchant.get(s.key) ?? s.key, cents: s.cents, count: s.count }))} />
        </Section>
      </div>

      <Section title="Gastos em cada cartão" hint="Toque em um cartão para ver todas as compras da fatura.">
        <div className="space-y-3">
          {view.cards.map((c) => (
            <details key={c.key} className="group rounded-lg border border-zinc-800">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                <i className="size-3 shrink-0 rounded-sm" style={{ background: c.color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate">{c.name}</b>
                    <span className="tabular-nums">{brl(c.total)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-zinc-800">
                    <span className="block h-1.5 rounded-full" style={{ width: `${view.total ? Math.max((c.total / view.total) * 100, 1) : 0}%`, background: c.color }} />
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-zinc-500">
                    {view.total ? `${((c.total / view.total) * 100).toFixed(0)}% do mês · ` : ''}{c.list.length} compras
                    {c.top.map((t) => <span key={t.key} className="chip max-w-full truncate">{t.key} {brl(t.cents)}</span>)}
                  </span>
                </span>
              </summary>
              <ul className="divide-y divide-zinc-800 border-t border-zinc-800 text-sm">
                {[...c.list].sort((a, b) => b.amount_cents - a.amount_cents).map((r) => {
                  const ci = info(r)
                  return (
                    <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate">{r.description}{r.installment_total ? <span className="ml-1.5 text-xs text-zinc-500">{r.installment_no}/{r.installment_total}</span> : null}</span>
                        <span className="text-xs text-zinc-500">{r.occurred_on.slice(8, 10)}/{r.occurred_on.slice(5, 7)} · <span className={ci.state === 'none' ? 'text-amber-400' : ''}>{ci.state === 'none' ? 'sem categoria' : ci.name}</span></span>
                      </span>
                      <span className={`shrink-0 tabular-nums ${r.amount_cents < 0 ? 'text-emerald-400' : ''}`}>{brl(r.amount_cents)}</span>
                    </li>
                  )
                })}
              </ul>
            </details>
          ))}
        </div>
      </Section>

      {futureTotal > 0 && (
        <Section title="Parcelas já contratadas" hint={`Compras parceladas da fatura de ${monthLabel(month)} que ainda vão cair: ${brl(futureTotal)} nos próximos 6 meses (considera só o que já está nesta fatura).`}>
          <StackedColumns months={view.future.map((f) => f.month)} series={[{ key: 'p', name: 'Parcelas', color: SERIES[0] }]}
            data={Object.fromEntries(view.future.map((f) => [f.month, { p: f.cents }]))} height={180} />
        </Section>
      )}
    </div>
  )
}
