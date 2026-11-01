import { futureDetail, sumCents, type LedgerRow } from './ledger'
import { txMonth } from './money'

export const daysInMonth = (y: number, m: number): number => new Date(y, m, 0).getDate() // m = 1..12
export const clampDay = (day: number, y: number, m: number): number => Math.min(day, daysInMonth(y, m))

/** Semanas começando no domingo; células vazias = null. */
export function monthGrid(y: number, m: number): (number | null)[][] {
  const lead = new Date(y, m - 1, 1).getDay()
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

/** Dias entre hoje e o vencimento (negativo = já passou). */
export function daysUntil(today: Date, y: number, m: number, day: number): number {
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.UTC(y, m - 1, day) - a) / 86_400_000)
}

export interface DueEvent {
  day: number
  kind: 'card' | 'bill'
  label: string
  cents: number | null // null = valor ainda desconhecido
  color: string
  note: string
}

export interface CalendarInput {
  ym: string // mês exibido (AAAA-MM)
  accounts: { id: string; name: string; due_day: number | null }[]
  rows: LedgerRow[]
  bills: { name: string; expected_cents: number; due_day: number }[]
  colorOf: (accountId: string) => string
  billColor: string
}

/**
 * Vencimentos do mês: a fatura de cada cartão (valor real se já importada; senão, só as parcelas já
 * contratadas, quando o mês é futuro) e as contas fixas. Ordenados por dia.
 */
export function buildEvents({ ym, accounts, rows, bills, colorOf, billColor }: CalendarInput): DueEvent[] {
  const [y, m] = ym.split('-').map(Number)
  const months = [...new Set(rows.map(txMonth))].sort()
  const latest = months.at(-1)
  const events: DueEvent[] = []

  for (const a of accounts) {
    if (!a.due_day) continue
    const own = rows.filter((r) => r.account_id === a.id && txMonth(r) === ym)
    let cents: number | null = null
    let note = 'sem fatura importada'
    if (own.length) { cents = sumCents(own); note = 'fatura' }
    else if (latest && ym > latest) {
      const k = (y - +latest.slice(0, 4)) * 12 + (m - +latest.slice(5))
      const proj = futureDetail(rows, latest, 12)[k - 1]?.items.filter((i) => i.row.account_id === a.id).reduce((s, i) => s + i.cents, 0) ?? 0
      if (proj > 0) { cents = proj; note = 'só as parcelas já contratadas' } else note = 'ainda sem fatura'
    }
    events.push({ day: clampDay(a.due_day, y, m), kind: 'card', label: a.name, cents, color: colorOf(a.id), note })
  }
  for (const b of bills) events.push({ day: clampDay(b.due_day, y, m), kind: 'bill', label: b.name, cents: b.expected_cents, color: billColor, note: 'conta fixa' })
  return events.sort((a, b) => a.day - b.day || a.label.localeCompare(b.label))
}
