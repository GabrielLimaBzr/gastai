'use client'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccountsFull, useTransactions } from '@/hooks/useData'
import { DueDayField } from '@/components/DueDayField'
import { FIXED_COLOR, monthLabel } from '@/components/charts'
import { cardStyle } from '@/lib/cards'
import { buildEvents, daysUntil, monthGrid } from '@/lib/calendar'
import { addMonths } from '@/lib/ledger'
import { brl } from '@/lib/money'

interface Bill { name: string; expected_cents: number; due_day: number }

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function when(d: number): string {
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d > 1) return `em ${d} dias`
  return d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`
}

export default function Calendar() {
  const supabase = createClient()
  const { rows, loading } = useTransactions()
  const { accounts, setDueDay } = useAccountsFull()
  const [bills, setBills] = useState<Bill[]>([])
  const [ym, setYm] = useState('')
  const [today, setToday] = useState<Date | null>(null)
  const [pick, setPick] = useState<number | null>(null)

  useEffect(() => {
    const t = new Date()
    setToday(t); setYm(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`)
    supabase.from('recurring_bills').select('name,expected_cents,due_day').eq('active', true).then(({ data }) => setBills((data as Bill[]) ?? []))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const events = useMemo(() => (ym ? buildEvents({
    ym, accounts, rows, bills, billColor: FIXED_COLOR, colorOf: (id) => cardStyle(accounts, id).color,
  }) : []), [ym, accounts, rows, bills])

  if (loading || !ym || !today) return <p className="text-zinc-500">Carregando…</p>

  const [y, m] = ym.split('-').map(Number)
  const grid = monthGrid(y, m)
  const isThisMonth = today.getFullYear() === y && today.getMonth() + 1 === m
  const shown = pick ? events.filter((e) => e.day === pick) : events
  const cardsTotal = events.filter((e) => e.kind === 'card').reduce((s, e) => s + (e.cents ?? 0), 0)
  const billsTotal = events.filter((e) => e.kind === 'bill').reduce((s, e) => s + e.cents!, 0)
  const unknown = events.filter((e) => e.cents == null).length
  const noDay = accounts.filter((a) => !a.due_day)

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

      <section className="card">
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-500" aria-hidden>{WEEK.map((d, i) => <span key={i}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`Vencimentos de ${monthLabel(ym)}`}>
          {grid.flat().map((day, i) => {
            if (!day) return <span key={i} />
            const ev = events.filter((e) => e.day === day)
            const isToday = isThisMonth && today.getDate() === day
            return (
              <button key={i} type="button" onClick={() => setPick(pick === day ? null : day)} aria-pressed={pick === day}
                aria-label={`Dia ${day}${ev.length ? `: ${ev.map((e) => e.label).join(', ')}` : ''}`}
                className={`flex min-h-12 flex-col items-center justify-start gap-1 rounded-lg border py-1 text-sm
                  ${pick === day ? 'border-emerald-500 bg-emerald-500/10' : ev.length ? 'border-zinc-700 bg-zinc-800/60' : 'border-transparent'}
                  ${isToday ? 'ring-1 ring-emerald-400' : ''}`}>
                <span className={isToday ? 'font-semibold text-emerald-400' : ''}>{day}</span>
                <span className="flex gap-0.5">{ev.slice(0, 4).map((e, k) => <i key={k} className="inline-block size-1.5 rounded-full" style={{ background: e.color }} />)}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500">Toque num dia para ver só os vencimentos dele.</p>
      </section>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">{pick ? `Dia ${pick}` : 'Vencimentos do mês'}</h2>
          {pick && <button className="text-xs text-emerald-400" onClick={() => setPick(null)}>Ver todos</button>}
        </div>
        {!shown.length ? (
          <p className="mt-2 text-sm text-zinc-500">{events.length ? 'Nada vence neste dia.' : 'Nenhum vencimento cadastrado para este mês.'}</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-800">
            {shown.map((e, i) => {
              const d = isThisMonth ? daysUntil(today, y, m, e.day) : null
              return (
                <li key={i} className="flex items-start gap-3 py-2.5">
                  <span className="w-9 shrink-0 pt-0.5 text-center text-lg font-semibold tabular-nums">{String(e.day).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm"><i className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: e.color }} aria-hidden /><span className="truncate">{e.label}</span></span>
                    <span className="text-xs text-zinc-500">{e.note}{d != null && <span className={d < 0 ? 'text-amber-400' : ''}> · {when(d)}</span>}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">{e.cents == null ? '—' : brl(e.cents)}</span>
                </li>
              )
            })}
          </ul>
        )}
        {events.length > 0 && (
          <p className="mt-3 border-t border-zinc-800 pt-3 text-sm text-zinc-400">
            Total no mês: <b className="text-zinc-100">{brl(cardsTotal + billsTotal)}</b> · faturas {brl(cardsTotal)} + fixas {brl(billsTotal)}
            {unknown > 0 && <span className="block text-xs text-zinc-500">{unknown} vencimento(s) ainda sem valor conhecido não entram na soma.</span>}
          </p>
        )}
      </section>
    </div>
  )
}
