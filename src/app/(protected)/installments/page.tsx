'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts, useTransactions } from '@/hooks/useData'
import { FIXED_COLOR, StackedColumns, monthLabel, type Series } from '@/components/charts'
import { cardStyle } from '@/lib/cards'
import { endingSchedule, futureDetail, groupSum, monthsDesc } from '@/lib/ledger'
import { brl } from '@/lib/money'

const FIXED = '__fixed__'

const Dot = ({ color }: { color: string }) => <i className="inline-block size-2 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />

export default function Installments() {
  const supabase = createClient()
  const { rows, loading } = useTransactions()
  const accounts = useAccounts()
  const [base, setBase] = useState('')
  const [income, setIncome] = useState(0)
  const [fixedTotal, setFixedTotal] = useState(0)
  // a renda esticava o eixo e achatava as colunas das parcelas: por padrão fica de fora do gráfico
  const [showIncome, setShowIncome] = useState(false)
  useEffect(() => { try { setShowIncome(localStorage.getItem('gastai:inst-income') === '1') } catch { /* sem storage */ } }, [])
  function toggleIncome(on: boolean) { setShowIncome(on); try { localStorage.setItem('gastai:inst-income', on ? '1' : '0') } catch { /* sem storage */ } }

  const months = useMemo(() => monthsDesc(rows), [rows])
  useEffect(() => { if (!base && months.length) setBase(months[0]) }, [months, base])

  useEffect(() => {
    supabase.from('recurring_bills').select('expected_cents').eq('active', true)
      .then(({ data }) => setFixedTotal((data ?? []).reduce((s, b) => s + b.expected_cents, 0)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!base) return
    supabase.from('income').select('amount_cents').eq('month', `${base}-01`)
      .then(({ data }) => setIncome((data ?? []).reduce((s, r) => s + r.amount_cents, 0)))
  }, [base]) // eslint-disable-line react-hooks/exhaustive-deps

  const view = useMemo(() => {
    const all = futureDetail(rows, base, 12)
    const last = all.reduce((acc, m, i) => (m.cents > 0 ? i : acc), -1)
    const future = all.slice(0, last + 1) // sem meses vazios no fim
    const schedule = endingSchedule(rows, base)
    return { future, schedule, remaining: future.reduce((s, m) => s + m.cents, 0) }
  }, [rows, base])

  if (loading) return <p className="text-zinc-500">Carregando…</p>
  if (!months.length) return <p className="text-zinc-400">Importe uma fatura para ver as parcelas.</p>

  // cartões que ainda têm parcela futura (cores iguais às do Resumo) + contas fixas
  const cardIds = [...new Set(view.future.flatMap((m) => m.items.map((i) => i.row.account_id ?? '')))]
  const series: Series[] = [
    ...accounts.filter((a) => cardIds.includes(a.id)).map((a) => ({ key: a.id, name: a.name, color: cardStyle(accounts, a.id).color })),
    ...(fixedTotal > 0 ? [{ key: FIXED, name: 'Contas fixas', color: FIXED_COLOR }] : []),
  ]
  const chartData: Record<string, Record<string, number>> = {}
  for (const m of view.future) {
    chartData[m.month] = Object.fromEntries(groupSum(m.items, (i) => i.row.account_id ?? '', (i) => i.cents).map((g) => [g.key, g.cents]))
    if (fixedTotal > 0) chartData[m.month][FIXED] = fixedTotal
  }
  const marker = income > 0 && showIncome ? Object.fromEntries(view.future.map((m) => [m.month, income])) : undefined
  const first = view.future[0]
  const peak = view.future.reduce((a, m) => (m.cents > a.cents ? m : a), view.future[0] ?? { month: '', cents: 0 })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Parcelas futuras</h1>
        <select className="input w-auto" value={base} onChange={(e) => setBase(e.target.value)} aria-label="Projetar a partir da fatura de">
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <p className="text-sm text-zinc-500">
        O que já está parcelado nas faturas de <b>{monthLabel(base)}</b> e ainda vai cair nos próximos meses. Compras novas ainda não entram.
      </p>

      {!view.future.length ? (
        <p className="card text-sm text-zinc-400">Nenhuma parcela futura nas faturas deste mês. ✓</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="card min-w-0"><p className="text-xs text-zinc-400">Ainda vai cair</p><p className="mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl">{brl(view.remaining)}</p><p className="mt-0.5 text-xs text-zinc-500">{view.schedule.length} parcelamentos</p></div>
            <div className="card min-w-0"><p className="text-xs text-zinc-400">Próximo mês ({monthLabel(first.month)})</p><p className="mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl">{brl(first.cents)}</p><p className="mt-0.5 text-xs text-zinc-500">{first.items.length} parcelas</p></div>
            <div className="card col-span-2 min-w-0 md:col-span-1"><p className="text-xs text-zinc-400">Mês mais pesado ({monthLabel(peak.month)})</p><p className="mt-1 truncate text-xl font-semibold tabular-nums sm:text-2xl">{brl(peak.cents)}</p><p className="mt-0.5 text-xs text-zinc-500">termina tudo em {monthLabel(view.future[view.future.length - 1].month)}</p></div>
          </div>

          <section className="card">
            <h2 className="font-medium">Já comprometido por mês</h2>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-500">
                Parcelas por cartão{fixedTotal > 0 ? ' + contas fixas' : ''}
                {marker ? `; a linha branca é a renda de ${monthLabel(base)}` : ''}.
              </p>
              {income > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                  <input type="checkbox" className="size-4 accent-emerald-500" checked={showIncome} onChange={(e) => toggleIncome(e.target.checked)} />
                  Mostrar a renda no gráfico
                </label>
              )}
            </div>
            <StackedColumns months={view.future.map((m) => m.month)} series={series} data={chartData} marker={marker} markerLabel={`Renda de ${monthLabel(base)}`} />
          </section>

          <section className="card">
            <h2 className="font-medium">O que cai em cada mês</h2>
            <p className="mb-3 text-xs text-zinc-500">Toque num mês para ver cada parcela e de qual cartão ela vem.</p>
            <div className="space-y-2">
              {view.future.map((m) => {
                const byCard = groupSum(m.items, (i) => i.row.account_id ?? '', (i) => i.cents)
                const committed = m.cents + fixedTotal
                return (
                  <details key={m.month} className="group rounded-lg border border-zinc-800">
                    <summary className="cursor-pointer list-none p-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-baseline justify-between gap-3">
                        <b>{monthLabel(m.month)}</b>
                        <span className="tabular-nums">{brl(m.cents)} <span className="text-xs text-zinc-500">em {m.items.length} parcelas</span></span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {byCard.map((c) => {
                          const card = cardStyle(accounts, c.key || null)
                          return <span key={c.key} className="chip"><Dot color={card.color} />{card.name} {brl(c.cents)}</span>
                        })}
                      </span>
                      {income > 0 && (
                        <span className="mt-1.5 block text-xs text-zinc-500">
                          Com as fixas: comprometido <b className="text-zinc-300">{brl(committed)}</b> · livre{' '}
                          <b className={income - committed >= 0 ? 'text-emerald-400' : 'text-red-400'}>{brl(income - committed)}</b> para gastar
                        </span>
                      )}
                    </summary>
                    <ul className="divide-y divide-zinc-800 border-t border-zinc-800 text-sm">
                      {m.items.map((it) => {
                        const card = cardStyle(accounts, it.row.account_id)
                        return (
                          <li key={it.row.id} className="flex items-start justify-between gap-3 px-3 py-2">
                            <span className="min-w-0">
                              <span className="block truncate">{it.row.description}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                                <span>parcela {it.no}/{it.total}{it.no === it.total ? ' · última' : ''}</span>
                                <span className="inline-flex items-center gap-1"><Dot color={card.color} />{card.name}</span>
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">{brl(it.cents)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  </details>
                )
              })}
            </div>
          </section>

          <section className="card">
            <h2 className="font-medium">Quando cada parcelamento termina</h2>
            <p className="mb-3 text-xs text-zinc-500">Do que acaba primeiro ao que dura mais: é quando o seu orçamento ganha folga.</p>
            <ul className="divide-y divide-zinc-800 text-sm">
              {view.schedule.map((e) => {
                const card = cardStyle(accounts, e.row.account_id)
                return (
                  <li key={e.row.id} className="flex items-start justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate">{e.row.description}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
                        <span>faltam {e.left} · termina em {monthLabel(e.endMonth)}</span>
                        <span className="inline-flex items-center gap-1"><Dot color={card.color} />{card.name}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right tabular-nums">{brl(e.remainingCents)}<span className="block text-xs text-zinc-500">{brl(e.row.amount_cents)}/mês</span></span>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
