'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts, useTransactions, type TxRow } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { usePayments } from '@/hooks/usePayments'
import { useBills } from '@/hooks/useBills'
import { attention, buildEvents, dueLabel } from '@/lib/calendar'
import { Donut, FIXED_COLOR, HBars, StackedColumns, monthLabel, type DonutSlice, type Series } from '@/components/charts'
import { RING, RING_OTHER, SERIES } from '@/lib/palette'
import { categorize, flexibleCents, foldTop, futureInstallments, groupSum, merchantKey, monthsDesc, sumCents } from '@/lib/ledger'
import { cardStyle } from '@/lib/cards'
import { brl, monthKey, txMonth } from '@/lib/money'
import { useSharedMonth } from '@/contexts/month'

const NO_CARD = '__none__'
const FIXED = '__fixed__'


function Tile({ label, value, sub, note, href, tone }: { label: string; value: string; sub?: string; note?: string; href?: string; tone?: 'bad' | 'good' }) {
  const body = (
    <div className="card h-full min-w-0">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl ${tone === 'bad' ? 'text-red-400' : tone === 'good' ? 'text-emerald-400' : ''}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      {note && <p className="text-xs text-zinc-500">{note}</p>}
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
  const pay = usePayments()
  const [income, setIncome] = useState<Record<string, number>>({})
  const { bills, forMonth, fixedFor, ready: billsReady } = useBills()
  const [catView, setCatView] = useState<'donut' | 'bars'>('donut')

  // preferência de visualização: só conveniência do aparelho, por isso localStorage com try/catch
  useEffect(() => { try { const v = localStorage.getItem('gastai:catview'); if (v === 'bars' || v === 'donut') setCatView(v) } catch { /* sem storage */ } }, [])
  function pickCatView(v: 'donut' | 'bars') { setCatView(v); try { localStorage.setItem('gastai:catview', v) } catch { /* sem storage */ } }

  useEffect(() => {
    supabase.from('income').select('month,amount_cents').then(({ data }) => {
      const m: Record<string, number> = {}
      for (const r of data ?? []) m[monthKey(r.month)] = (m[monthKey(r.month)] ?? 0) + r.amount_cents
      setIncome(m)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const months = useMemo(() => monthsDesc(rows), [rows])
  const [month, setMonth] = useSharedMonth(months, months[0] ?? '')

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
      key: id, color: id === NO_CARD ? '#71717a' : cardStyle(accounts, id).color,
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

  if (loading || !ready || !pay.ready || !billsReady) return <p className="text-zinc-500">Carregando…</p>
  if (!months.length) return <p className="text-zinc-400">Nenhum dado ainda. Comece em <b>Importar</b>.</p>

  // contas fixas e variáveis do mês (variável: valor informado, ou o do mês anterior como estimativa); entram no total, na sobra e no gráfico
  const monthBills = forMonth(month)
  const fixedTotal = fixedFor(month)
  const grand = view.total + fixedTotal
  const inc = income[month] ?? 0
  const left = inc - grand
  const flex = flexibleCents(view.byCategory)
  const futureTotal = view.future.reduce((s, f) => s + f.cents, 0)
  const prevMonthKey = months[months.indexOf(month) + 1]
  const prevGrand = view.prevTotal == null || !prevMonthKey ? null : view.prevTotal + fixedFor(prevMonthKey)
  const delta = prevGrand ? (grand - prevGrand) / prevGrand : null
  // fatias das roscas: no máximo 5 categorias + "Outras" (cores validadas para fatias vizinhas)
  const catSlices: DonutSlice[] = foldTop(view.byCategory, 5).map((s, i) => ({ key: s.key, label: s.label, cents: s.cents, color: s.folded ? RING_OTHER : RING[i], note: `${s.count}x` }))
  // categorias que já passaram da meta mensal neste mês
  const overGoals = view.byCategory.flatMap((s) => {
    const goal = cats.find((c) => c.name === s.key)?.goal_cents
    return goal && s.cents > goal ? [{ name: s.key, over: s.cents - goal }] : []
  })
  // vencimentos atrasados ou nos próximos 7 dias que ainda não foram marcados como pagos
  const due = attention(
    new Date(),
    (ym) => buildEvents({ ym, accounts, rows, bills: forMonth(ym), billColor: FIXED_COLOR, colorOf: (id) => cardStyle(accounts, id).color }),
    (e, ym) => !!pay.find(e.kind, e.ref, ym),
  )
  const catTotal = catSlices.reduce((s, x) => s + x.cents, 0)
  const cardSlices: DonutSlice[] = [
    ...view.cards.map((c) => ({ key: c.key, label: c.name, cents: c.total, color: c.color })),
    ...(fixedTotal > 0 ? [{ key: FIXED, label: 'Contas fixas', cents: fixedTotal, color: FIXED_COLOR }] : []),
  ]
  const incomeSlices: DonutSlice[] = [
    { key: 'cards', label: 'Cartões', cents: view.total, color: RING[0] },
    ...(fixedTotal > 0 ? [{ key: 'fixed', label: 'Contas fixas', cents: fixedTotal, color: FIXED_COLOR }] : []),
    ...(left > 0 ? [{ key: 'left', label: 'Sobra', cents: left, color: RING[1] }] : []),
  ]
  const chartSeries: Series[] = fixedTotal > 0 ? [...view.series, { key: FIXED, name: 'Contas fixas', color: FIXED_COLOR }] : view.series
  const chartData = fixedTotal > 0
    ? Object.fromEntries(view.monthsAsc.map((m) => [m, { ...(view.evolution[m] ?? {}), [FIXED]: fixedFor(m) }]))
    : view.evolution

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Resumo</h1>
        <select className="input w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mês da fatura">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Gasto no mês" value={brl(grand)}
          sub={delta == null ? 'faturas de ' + monthLabel(month) : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta * 100).toFixed(0)}% vs mês anterior`}
          note={fixedTotal > 0 ? `cartões ${brl(view.total)} + fixas ${brl(fixedTotal)}` : undefined} />
        <button className="text-left" onClick={setIncomeFor}>
          <Tile label="Renda" value={inc ? brl(inc) : '—'} sub={inc ? `${((grand / inc) * 100).toFixed(0)}% da renda · toque p/ editar` : 'toque para definir'} />
        </button>
        <Tile label={inc ? (left >= 0 ? 'Sobra' : 'Estouro') : 'Sobra'} value={inc ? brl(Math.abs(left)) : '—'} tone={inc ? (left >= 0 ? 'good' : 'bad') : undefined}
          sub={inc ? (left >= 0 ? 'renda − gastos' : 'gastos acima da renda') : 'defina a renda'} />
        <Tile label="Cortável" value={brl(flex)} sub={grand ? `${((flex / grand) * 100).toFixed(0)}% do gasto` : undefined} href="/analysis" />
      </div>

      {view.pending.length > 0 && (
        <Link href={`/transactions?filtro=sem-categoria&mes=${month}`}
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span><b>{view.pending.length} {view.pending.length === 1 ? 'compra sem categoria' : 'compras sem categoria'}</b> ({brl(sumCents(view.pending))}) — categorize para a análise ficar correta</span>
          <span className="shrink-0 text-amber-300">Categorizar →</span>
        </Link>
      )}

      {(due.overdue.length > 0 || due.soon.length > 0) && (
        <Link href="/calendar" className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${due.overdue.length ? 'border-red-500/40 bg-red-500/10' : 'border-sky-500/30 bg-sky-500/10'}`}>
          <span className="min-w-0">
            {due.overdue.length > 0 && (
              <span className="block"><b>{due.overdue.length === 1 ? '1 vencimento atrasado' : `${due.overdue.length} vencimentos atrasados`}:</b> {due.overdue.slice(0, 3).map((e) => `${e.label} (${dueLabel(e.inDays)})`).join(', ')}</span>
            )}
            {due.soon.length > 0 && (
              <span className="block"><b>Vence em breve:</b> {due.soon.slice(0, 3).map((e) => `${e.label} (${dueLabel(e.inDays).replace('vence ', '')}${e.cents != null ? `, ${brl(e.cents)}` : ''})`).join(', ')}</span>
            )}
          </span>
          <span className="shrink-0 text-zinc-300">Calendário →</span>
        </Link>
      )}

      {overGoals.length > 0 && (
        <Link href="/goals" className="flex items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm">
          <span>
            <b>{overGoals.length === 1 ? '1 categoria passou' : `${overGoals.length} categorias passaram`} da meta</b>
            {' — '}{overGoals.slice(0, 3).map((g) => `${g.name} (+${brl(g.over)})`).join(', ')}
          </span>
          <span className="shrink-0 text-red-300">Ver metas →</span>
        </Link>
      )}

      {inc > 0 && (
        <Section title="Como a renda é usada" hint={`Renda de ${monthLabel(month)}: ${brl(inc)}${left < 0 ? ' — os gastos passaram da renda.' : '.'}`}>
          <Donut slices={incomeSlices} centerLabel={left >= 0 ? 'Sobra' : 'Estouro'} centerValue={brl(Math.abs(left))} centerTone={left < 0 ? 'bad' : undefined} />
        </Section>
      )}

      <Section title="Gasto por mês" hint={fixedTotal > 0
          ? 'Cada coluna soma as faturas dos cartões e as contas fixas; a linha branca é a renda.'
          : 'Cada coluna é a soma das faturas do mês; a linha branca é a renda. Cadastre suas contas fixas para elas entrarem aqui.'}>
        <StackedColumns months={view.monthsAsc} series={chartSeries} data={chartData} marker={Object.keys(income).length ? income : undefined} markerLabel="Renda" />
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Por categoria" hint="Compras no cartão, em reais e % do total no cartão.">
          <div className="mb-3 inline-flex rounded-lg border border-zinc-700 p-0.5 text-sm" role="group" aria-label="Tipo de gráfico">
            {([['donut', 'Rosca'], ['bars', 'Barras']] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={catView === id} onClick={() => pickCatView(id)}
                className={`rounded-md px-3 py-1 ${catView === id ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>{label}</button>
            ))}
          </div>
          {catView === 'donut'
            ? <Donut stacked slices={catSlices} centerLabel="No cartão" centerValue={brl(catTotal)} />
            : <HBars items={view.byCategory.slice(0, 10).map((s) => ({ key: s.key, label: s.key, cents: s.cents, count: s.count }))} />}
        </Section>
        <Section title="Onde mais gasto" hint="Maiores estabelecimentos do mês.">
          <HBars items={view.byMerchant.slice(0, 10).map((s) => ({ key: s.key, label: view.nameOfMerchant.get(s.key) ?? s.key, cents: s.cents, count: s.count }))} />
        </Section>
      </div>

      <Section title="Gastos em cada cartão" hint="Toque em um cartão para ver todas as compras da fatura; as contas fixas aparecem no fim.">
        <div className="mb-5"><Donut slices={cardSlices} centerLabel="Gasto no mês" centerValue={brl(grand)} /></div>
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
                    <span className="block h-1.5 rounded-full" style={{ width: `${grand ? Math.max((c.total / grand) * 100, 1) : 0}%`, background: c.color }} />
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-zinc-500">
                    {grand ? `${((c.total / grand) * 100).toFixed(0)}% do mês · ` : ''}{c.list.length} {c.list.length === 1 ? 'compra' : 'compras'}
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
          {monthBills.length > 0 && (
            <details className="group rounded-lg border border-zinc-800">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                <i className="size-3 shrink-0 rounded-sm" style={{ background: FIXED_COLOR }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate">Contas fixas</b>
                    <span className="tabular-nums">{brl(fixedTotal)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-zinc-800">
                    <span className="block h-1.5 rounded-full" style={{ width: `${grand ? Math.max((fixedTotal / grand) * 100, 1) : 0}%`, background: FIXED_COLOR }} />
                  </span>
                  <span className="mt-1.5 block text-xs text-zinc-500">{grand ? `${((fixedTotal / grand) * 100).toFixed(0)}% do mês · ` : ''}{monthBills.length} {monthBills.length === 1 ? 'conta' : 'contas'}{monthBills.some((b) => b.estimated) ? ' · inclui valores estimados' : ''}</span>
                </span>
              </summary>
              <ul className="divide-y divide-zinc-800 border-t border-zinc-800 text-sm">
                {[...monthBills].sort((a, b) => b.expected_cents - a.expected_cents).map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{b.name}</span>
                      <span className="text-xs text-zinc-500">vence dia {b.due_day}{b.variable ? (b.estimated ? ' · variável (estimado)' : ' · variável') : ''}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{b.estimated ? '~' : ''}{brl(b.expected_cents)}</span>
                  </li>
                ))}
              </ul>
              <Link href="/bills" className="block border-t border-zinc-800 px-3 py-2 text-xs text-emerald-400">Editar contas fixas →</Link>
            </details>
          )}
        </div>
      </Section>

      {futureTotal > 0 && (
        <Section title="Parcelas já contratadas" hint={`Compras parceladas da fatura de ${monthLabel(month)} que ainda vão cair: ${brl(futureTotal)} nos próximos 6 meses (considera só o que já está nesta fatura).`}>
          <StackedColumns months={view.future.map((f) => f.month)} series={[{ key: 'p', name: 'Parcelas', color: SERIES[0] }]}
            data={Object.fromEntries(view.future.map((f) => [f.month, { p: f.cents }]))} height={180} />
          <Link href="/installments" className="mt-2 block text-sm text-emerald-400">Ver o que cai em cada mês →</Link>
        </Section>
      )}
    </div>
  )
}
