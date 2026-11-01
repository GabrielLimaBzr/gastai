'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccountsFull, useTransactions } from '@/hooks/useData'
import { usePayments } from '@/hooks/usePayments'
import { DueDayField } from '@/components/DueDayField'
import { FIXED_COLOR, monthLabel } from '@/components/charts'
import { cardStyle } from '@/lib/cards'
import { buildEvents, daysUntil, dueLabel, monthGrid, type DueEvent } from '@/lib/calendar'
import { addMonths } from '@/lib/ledger'
import { brl, toCents } from '@/lib/money'

interface Bill { id: string; name: string; expected_cents: number; due_day: number }

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export default function Calendar() {
  const supabase = createClient()
  const { rows, loading } = useTransactions()
  const { accounts, setDueDay } = useAccountsFull()
  const pay = usePayments()
  const [bills, setBills] = useState<Bill[]>([])
  const [ym, setYm] = useState('')
  const [today, setToday] = useState<Date | null>(null)
  const [pick, setPick] = useState<number | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const t = new Date()
    setToday(t); setYm(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
    supabase.from('recurring_bills').select('id,name,expected_cents,due_day').eq('active', true).then(({ data }) => setBills((data as Bill[]) ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => (ym ? buildEvents({
    ym, accounts, rows, bills, billColor: FIXED_COLOR, colorOf: (id) => cardStyle(accounts, id).color,
  }) : []), [ym, accounts, rows, bills])

  if (loading || !ym || !today || !pay.ready) return <p className="text-zinc-500">Carregando…</p>

  const [y, m] = ym.split('-').map(Number)
  const grid = monthGrid(y, m)
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  const paymentOf = (e: DueEvent) => pay.find(e.kind, e.ref, ym)
  const shown = pick ? events.filter((e) => e.day === pick) : events
  const noDay = accounts.filter((a) => !a.due_day)

  // totais: o pago abate do total; "a pagar" é o que ainda não foi marcado
  const total = events.reduce((s, e) => s + (e.cents ?? 0), 0)
  const paidCents = events.reduce((s, e) => { const p = paymentOf(e); return p ? s + (p.amount_cents ?? e.cents ?? 0) : s }, 0)
  const toPay = events.filter((e) => !paymentOf(e)).reduce((s, e) => s + (e.cents ?? 0), 0)
  const paidCount = events.filter((e) => paymentOf(e)).length
  const unknown = events.filter((e) => e.cents == null && !paymentOf(e)).length
  const pending = events.filter((e) => !paymentOf(e))
  const overdue = isThisMonth ? pending.filter((e) => daysUntil(today, y, m, e.day) < 0) : []
  const next = isThisMonth ? pending.find((e) => daysUntil(today, y, m, e.day) >= 0) : undefined

  async function toggle(e: DueEvent) {
    setMsg('')
    const p = paymentOf(e)
    try {
      if (p) return await pay.unmark(p.id)
      let cents = e.cents
      if (cents == null) { // valor ainda desconhecido: pergunta quanto foi
        const v = prompt(`Quanto você pagou em «${e.label}»? (R$)`)
        if (v == null) return
        cents = toCents(v)
        if (!(cents > 0)) return setMsg('Informe um valor maior que zero.')
      }
      await pay.markPaid(e.kind, e.ref, ym, cents)
    } catch (err) {
      setMsg(`Não salvou: ${(err as Error).message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Calendário</h1>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2" onClick={() => { setYm(addMonths(ym, -1)); setPick(null) }} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
          <span className="min-w-20 text-center text-sm font-medium">{monthLabel(ym)}</span>
          <button className="btn-ghost px-2" onClick={() => { setYm(addMonths(ym, 1)); setPick(null) }} aria-label="Próximo mês"><ChevronRight size={18} /></button>
        </div>
      </div>

      {noDay.length > 0 && (
        <div className="card space-y-2 border-amber-500/40">
          <p className="text-sm">Informe o dia em que cada fatura vence para ela aparecer no calendário:</p>
          {noDay.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-sm"><i className="inline-block size-2.5 rounded-sm" style={{ background: cardStyle(accounts, a.id).color }} aria-hidden />{a.name}</span>
              <DueDayField value={a.due_day} onSave={(d) => setDueDay(a.id, d)} />
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && (
        <section className="card space-y-3" aria-label="Resumo do mês">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500">A pagar</p>
              <p className={`text-2xl font-semibold tabular-nums ${toPay > 0 ? '' : 'text-emerald-400'}`}>{brl(toPay)}</p>
            </div>
            <dl className="text-right text-sm tabular-nums">
              <div className="flex justify-end gap-2"><dt className="text-zinc-500">Total</dt><dd>{brl(total)}</dd></div>
              <div className="flex justify-end gap-2"><dt className="text-zinc-500">Pago</dt><dd className="text-emerald-400">{brl(paidCents)}</dd></div>
            </dl>
          </div>
          <div className="h-2 rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={total ? Math.min(Math.round((paidCents / total) * 100), 100) : 0} aria-label="Quanto do mês já foi pago">
            <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${total ? Math.min((paidCents / total) * 100, 100) : 0}%` }} />
          </div>
          <p className="text-xs text-zinc-500">{paidCount} de {events.length} vencimentos pagos</p>
          {isThisMonth && overdue.length > 0 && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
              <b>{overdue.length} {overdue.length === 1 ? 'vencimento atrasado' : 'vencimentos atrasados'}:</b> {overdue.map((e) => `${e.label}${e.cents != null ? ` (${brl(e.cents)})` : ''}`).join(', ')}
            </p>
          )}
          {isThisMonth && !overdue.length && next && (
            <p className="text-sm text-zinc-300">Próximo: <b>{next.label}</b>, {dueLabel(daysUntil(today, y, m, next.day))}{next.cents != null ? ` · ${brl(next.cents)}` : ''}</p>
          )}
          {isThisMonth && !pending.length && <p className="text-sm text-emerald-400">Tudo pago neste mês ✓</p>}
        </section>
      )}

      <section className="card">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500" aria-hidden>{WEEK.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`Vencimentos de ${monthLabel(ym)}`}>
          {grid.flat().map((day, i) => {
            if (!day) return <span key={i} />
            const ev = events.filter((e) => e.day === day)
            const isToday = isThisMonth && today.getDate() === day
            const allPaid = ev.length > 0 && ev.every((e) => paymentOf(e))
            return (
              <button key={i} type="button" onClick={() => setPick(pick === day ? null : day)} aria-pressed={pick === day}
                aria-label={`Dia ${day}${ev.length ? `: ${ev.map((e) => `${e.label}${paymentOf(e) ? ' (pago)' : ''}`).join(', ')}` : ''}`}
                className={`flex min-h-12 flex-col items-center justify-start gap-1 rounded-lg border py-1 text-sm
                  ${pick === day ? 'border-emerald-500 bg-emerald-500/10' : ev.length ? 'border-zinc-700 bg-zinc-800/60' : 'border-transparent'}
                  ${isToday ? 'ring-1 ring-emerald-400' : ''}`}>
                <span className={isToday ? 'font-semibold text-emerald-400' : allPaid ? 'text-zinc-500' : ''}>{day}</span>
                <span className="flex gap-0.5">
                  {ev.slice(0, 4).map((e, k) => paymentOf(e)
                    ? <i key={k} className="inline-block size-1.5 rounded-full border" style={{ borderColor: e.color }} /> /* pago = ponto vazado */
                    : <i key={k} className="inline-block size-1.5 rounded-full" style={{ background: e.color }} />)}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500">Ponto cheio = a pagar · ponto vazado = pago. Toque num dia para ver só os vencimentos dele.</p>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">{pick ? `Dia ${pick}` : 'Vencimentos do mês'}</h2>
          {pick && <button className="text-xs text-emerald-400" onClick={() => setPick(null)}>Ver todos</button>}
        </div>
        {msg && <p className="mt-2 text-sm text-amber-300" role="status">{msg}</p>}
        {!shown.length ? (
          <p className="mt-2 text-sm text-zinc-500">{events.length ? 'Nada vence neste dia.' : 'Nenhum vencimento cadastrado para este mês.'}</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-800">
            {shown.map((e) => {
              const p = paymentOf(e)
              const d = isThisMonth ? daysUntil(today, y, m, e.day) : null
              const late = !p && d != null && d < 0
              return (
                <li key={`${e.kind}-${e.ref}`} className={`flex items-start gap-3 py-2.5 ${p ? 'opacity-60' : ''}`}>
                  <button type="button" role="checkbox" aria-checked={!!p} onClick={() => toggle(e)}
                    aria-label={`${p ? 'Desmarcar' : 'Marcar como pago'}: ${e.label}`}
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border-2 ${p ? 'border-emerald-500 bg-emerald-500 text-zinc-950' : 'border-zinc-600 hover:border-emerald-400'}`}>
                    {p && <Check size={18} strokeWidth={3} aria-hidden />}
                  </button>
                  <span className="w-8 shrink-0 pt-0.5 text-center text-lg font-semibold tabular-nums">{String(e.day).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm"><i className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: e.color }} aria-hidden /><span className={`truncate ${p ? 'line-through' : ''}`}>{e.label}</span></span>
                    <span className="text-xs text-zinc-500">
                      {e.note}
                      {p ? <span className="text-emerald-400"> · pago em {dm(p.paid_on)}</span> : d != null && <span className={late ? 'text-red-400' : ''}> · {dueLabel(d)}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {e.cents == null && !p ? '—' : brl(p?.amount_cents ?? e.cents ?? 0)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {unknown > 0 && <p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">{unknown} vencimento(s) ainda sem valor conhecido não entram nos totais.</p>}
      </section>
    </div>
  )
}
