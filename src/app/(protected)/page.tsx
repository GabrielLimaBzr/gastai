'use client'
import Link from 'next/link'
import { AlertCircle, ArrowDown, ArrowUp, CalendarClock, ChevronRight, Pencil, Target } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts, useTransactions, type TxRow } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { usePayments } from '@/hooks/usePayments'
import { useBills } from '@/hooks/useBills'
import { QuickStart } from '@/components/QuickStart'
import { Welcome } from '@/components/Welcome'
import { attention, buildEvents, dueLabel } from '@/lib/calendar'
import { Donut, HBars, StackedColumns, monthLabel, type DonutSlice, type Series } from '@/components/charts'
import { palette } from '@/lib/palette'
import { categorize, flexibleCents, foldTop, futureInstallments, groupSum, merchantKey, monthsDesc, sumCents } from '@/lib/ledger'
import { cardStyle } from '@/lib/cards'
import { brl, monthKey, monthName, txMonth } from '@/lib/money'
import { useSharedMonth } from '@/contexts/month'
import { MonthSwitcher, Notice, PageHeader, PageSkeleton, Segmented } from '@/components/ui'

const NO_CARD = '__none__'
const FIXED = '__fixed__'


/** Seção plana: título + apoio, separada das outras por uma linha fina (cards ficam para o que é interativo). */
const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="border-t border-zinc-800 pt-6">
    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    {hint && <p className="mt-0.5 text-sm text-zinc-400">{hint}</p>}
    <div className="mt-4">{children}</div>
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
      key: id, color: id === NO_CARD ? palette().none : cardStyle(accounts, id).color,
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

  // atalho do guia de primeiros passos: /?renda=1 abre a pergunta da renda do mês
  useEffect(() => {
    if (loading || !month) return
    if (new URLSearchParams(location.search).get('renda') === '1') { history.replaceState(null, '', '/'); setIncomeFor() }
  }, [loading, month]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !ready || !pay.ready || !billsReady) return <PageSkeleton />
  if (!months.length) return <Welcome />

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
  const catSlices: DonutSlice[] = foldTop(view.byCategory, 5).map((s, i) => ({ key: s.key, label: s.label, cents: s.cents, color: s.folded ? palette().ringOther : palette().ring[i], note: `${s.count}x` }))
  // categorias que já passaram da meta mensal neste mês
  const overGoals = view.byCategory.flatMap((s) => {
    const goal = cats.find((c) => c.name === s.key)?.goal_cents
    return goal && s.cents > goal ? [{ name: s.key, over: s.cents - goal }] : []
  })
  // vencimentos atrasados ou nos próximos 7 dias que ainda não foram marcados como pagos
  const due = attention(
    new Date(),
    (ym) => buildEvents({ ym, accounts, rows, bills: forMonth(ym), billColor: palette().fixed, colorOf: (id) => cardStyle(accounts, id).color }),
    (e, ym) => !!pay.find(e.kind, e.ref, ym),
  )
  const catTotal = catSlices.reduce((s, x) => s + x.cents, 0)
  const cardSlices: DonutSlice[] = [
    ...view.cards.map((c) => ({ key: c.key, label: c.name, cents: c.total, color: c.color })),
    ...(fixedTotal > 0 ? [{ key: FIXED, label: 'Contas fixas', cents: fixedTotal, color: palette().fixed }] : []),
  ]
  const incomeSlices: DonutSlice[] = [
    { key: 'cards', label: 'Cartões', cents: view.total, color: palette().ring[0] },
    ...(fixedTotal > 0 ? [{ key: 'fixed', label: 'Contas fixas', cents: fixedTotal, color: palette().fixed }] : []),
    ...(left > 0 ? [{ key: 'left', label: 'Sobra', cents: left, color: palette().ring[1] }] : []),
  ]
  const chartSeries: Series[] = fixedTotal > 0 ? [...view.series, { key: FIXED, name: 'Contas fixas', color: palette().fixed }] : view.series
  const chartData = fixedTotal > 0
    ? Object.fromEntries(view.monthsAsc.map((m) => [m, { ...(view.evolution[m] ?? {}), [FIXED]: fixedFor(m) }]))
    : view.evolution

  return (
    <div className="space-y-8">
      <PageHeader title="Resumo" description={`Fatura de ${monthName(month, true)}`}
        actions={<MonthSwitcher value={month} onChange={setMonth} options={months} label="Mês da fatura" />} />

      <QuickStart />

      {/* o destaque da tela: quanto sobra (ou quanto foi gasto, se a renda ainda não foi informada) */}
      <section aria-label="Situação do mês" className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 md:p-8" style={{ boxShadow: 'var(--shadow-sheet)' }}>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="text-sm text-zinc-400">{inc ? (left >= 0 ? `Sobra de ${monthName(month)}` : `Estouro de ${monthName(month)}`) : `Gasto de ${monthName(month)}`}</p>
            <p className={`mt-1.5 break-words text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums md:text-6xl ${inc && left < 0 ? 'text-red-400' : ''}`}>{brl(inc ? Math.abs(left) : grand)}</p>
            <p className="mt-3 text-sm text-zinc-400">
              {inc ? `${Math.round((grand / inc) * 100)}% da renda já foi gasto.` : (
                <><button type="button" onClick={setIncomeFor} className="font-medium text-emerald-500 underline underline-offset-4">Informe a renda do mês</button> para ver quanto sobra.</>
              )}
            </p>
          </div>
          {delta != null && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${delta > 0 ? 'border-amber-500/40 text-amber-400' : 'border-emerald-500/40 text-emerald-400'}`}
              title="Gasto total contra o mês anterior">
              {delta > 0 ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />}
              {Math.abs(Math.round(delta * 100))}% {delta > 0 ? 'a mais' : 'a menos'} que no mês anterior
            </span>
          )}
        </div>
        {inc > 0 && (
          <div className="mt-6 h-2.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.min(Math.round((grand / inc) * 100), 100)} aria-label="Quanto da renda já foi gasto">
            <div className={`h-full rounded-full ${left < 0 ? 'bg-red-500' : grand / inc >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min((grand / inc) * 100, 100)}%` }} />
          </div>
        )}
        <dl className="mt-6 divide-y divide-zinc-800 border-t border-zinc-800 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex items-baseline justify-between gap-3 py-3 sm:block sm:pb-0 sm:pl-0 sm:pr-5 sm:pt-5">
            <dt className="text-sm text-zinc-400">Gasto</dt>
            <dd className="whitespace-nowrap text-base font-semibold tabular-nums sm:mt-0.5 sm:text-xl">{brl(grand)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-3 sm:block sm:px-5 sm:pb-0 sm:pt-5">
            <dt className="flex items-center gap-1 text-sm text-zinc-400">Renda
              <button type="button" onClick={setIncomeFor} className="grid size-6 place-items-center rounded-md text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100" aria-label={inc ? 'Editar a renda do mês' : 'Informar a renda do mês'}><Pencil size={13} aria-hidden /></button>
            </dt>
            <dd className="whitespace-nowrap text-base font-semibold tabular-nums sm:mt-0.5 sm:text-xl">{inc ? brl(inc) : '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-3 sm:block sm:pb-0 sm:pl-5 sm:pr-0 sm:pt-5">
            <dt className="text-sm text-zinc-400">Cortável <Link href="/analysis" className="ml-1 text-xs text-emerald-500 underline underline-offset-2">ver onde</Link></dt>
            <dd className="whitespace-nowrap text-base font-semibold tabular-nums sm:mt-0.5 sm:text-xl">{brl(flex)}</dd>
          </div>
        </dl>
        {fixedTotal > 0 && <p className="mt-3 text-xs text-zinc-500">O gasto soma os cartões ({brl(view.total)}) e as contas fixas ({brl(fixedTotal)}).</p>}
      </section>

      {(view.pending.length > 0 || due.overdue.length > 0 || due.soon.length > 0 || overGoals.length > 0) && (
        <div className="space-y-2">
          {due.overdue.length > 0 && (
            <Notice tone="danger" icon={CalendarClock} href="/calendar">
              <b>{due.overdue.length === 1 ? '1 vencimento atrasado' : `${due.overdue.length} vencimentos atrasados`}:</b> {due.overdue.slice(0, 3).map((e) => `${e.label} (${dueLabel(e.inDays)})`).join(', ')}
            </Notice>
          )}
          {due.soon.length > 0 && (
            <Notice tone="info" icon={CalendarClock} href="/calendar">
              <b>Vence em breve:</b> {due.soon.slice(0, 3).map((e) => `${e.label} (${dueLabel(e.inDays).replace('vence ', '')}${e.cents != null ? `, ${brl(e.cents)}` : ''})`).join(', ')}
            </Notice>
          )}
          {overGoals.length > 0 && (
            <Notice tone="danger" icon={Target} href="/goals">
              <b>{overGoals.length === 1 ? '1 categoria passou' : `${overGoals.length} categorias passaram`} da meta:</b> {overGoals.slice(0, 3).map((g) => `${g.name} (+${brl(g.over)})`).join(', ')}
            </Notice>
          )}
          {view.pending.length > 0 && (
            <Notice tone="warn" icon={AlertCircle} href={`/transactions?filtro=sem-categoria&mes=${month}`}>
              <b>{view.pending.length} {view.pending.length === 1 ? 'compra sem categoria' : 'compras sem categoria'}</b> ({brl(sumCents(view.pending))}). Categorize para a análise ficar correta.
            </Notice>
          )}
        </div>
      )}

      {inc > 0 && (
        <Section title="Como a renda é usada" hint={left < 0 ? 'Os gastos passaram da renda do mês.' : 'Quanto vai para cartões e contas fixas, e quanto sobra.'}>
          <Donut slices={incomeSlices} centerLabel={left >= 0 ? 'Sobra' : 'Estouro'} centerValue={brl(Math.abs(left))} centerTone={left < 0 ? 'bad' : undefined} />
        </Section>
      )}

      <Section title="Gasto por mês" hint={fixedTotal > 0
          ? 'Cada coluna soma as faturas dos cartões e as contas fixas; a linha branca é a renda.'
          : 'Cada coluna é a soma das faturas do mês; a linha branca é a renda. Cadastre suas contas fixas para elas entrarem aqui.'}>
        <StackedColumns months={view.monthsAsc} series={chartSeries} data={chartData} marker={Object.keys(income).length ? income : undefined} markerLabel="Renda" />
      </Section>

      <div className="grid gap-8 md:grid-cols-2 md:gap-x-10">
        <Section title="Por categoria" hint="Compras no cartão, em reais e % do total no cartão.">
          <Segmented className="mb-4" label="Tipo de gráfico" value={catView} onChange={pickCatView} options={[{ value: 'donut', label: 'Rosca' }, { value: 'bars', label: 'Barras' }]} />
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
                <i className="size-3 shrink-0 rounded-sm" style={{ background: palette().fixed }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="truncate">Contas fixas</b>
                    <span className="tabular-nums">{brl(fixedTotal)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-zinc-800">
                    <span className="block h-1.5 rounded-full" style={{ width: `${grand ? Math.max((fixedTotal / grand) * 100, 1) : 0}%`, background: palette().fixed }} />
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
              <Link href="/bills" className="block border-t border-zinc-800 px-3 py-2 text-xs text-emerald-400">Editar contas fixas</Link>
            </details>
          )}
        </div>
      </Section>

      {futureTotal > 0 && (
        <Section title="Parcelas já contratadas" hint={`Compras parceladas da fatura de ${monthLabel(month)} que ainda vão cair: ${brl(futureTotal)} nos próximos 6 meses (considera só o que já está nesta fatura).`}>
          <StackedColumns months={view.future.map((f) => f.month)} series={[{ key: 'p', name: 'Parcelas', color: palette().rankBar }]}
            data={Object.fromEntries(view.future.map((f) => [f.month, { p: f.cents }]))} height={180} />
          <Link href="/installments" className="mt-2 block text-sm text-emerald-400">Ver o que cai em cada mês</Link>
        </Section>
      )}
    </div>
  )
}
