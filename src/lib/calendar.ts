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
  ref: string // id do cartão ou da conta fixa: é com ele que o pagamento é marcado
  label: string
  cents: number | null // null = valor ainda desconhecido
  color: string
  note: string
  variable?: boolean // conta variável (luz, água…): o valor muda todo mês
  estimated?: boolean // o valor ainda é uma estimativa, não o da conta
}

export interface CalendarInput {
  ym: string // mês exibido (AAAA-MM)
  accounts: { id: string; name: string; due_day: number | null }[]
  rows: LedgerRow[]
  bills: { id: string; name: string; expected_cents: number; due_day: number; variable?: boolean; estimated?: boolean }[]
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
    events.push({ day: clampDay(a.due_day, y, m), kind: 'card', ref: a.id, label: a.name, cents, color: colorOf(a.id), note })
  }
  for (const b of bills) {
    events.push({
      day: clampDay(b.due_day, y, m), kind: 'bill', ref: b.id, label: b.name, cents: b.expected_cents, color: billColor,
      note: b.variable ? (b.estimated ? 'conta variável · valor estimado' : 'conta variável · valor informado') : 'conta fixa',
      variable: b.variable, estimated: b.variable && b.estimated,
    })
  }
  return events.sort((a, b) => a.day - b.day || a.label.localeCompare(b.label))
}

export interface Pending extends DueEvent { ym: string; inDays: number }

/**
 * O que pede atenção hoje: vencimentos NÃO pagos do mês corrente que já passaram (atrasados) e os que vencem
 * nos próximos `windowDays` dias (pode virar o mês). Só olha o mês corrente para trás: faturas de meses
 * antigos nunca marcadas como pagas não devem aparecer como atrasadas.
 */
export function attention(today: Date, eventsOf: (ym: string) => DueEvent[], isPaid: (e: DueEvent, ym: string) => boolean, windowDays = 7): { overdue: Pending[]; soon: Pending[] } {
  const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const cur = ymOf(today)
  const next = ymOf(new Date(today.getFullYear(), today.getMonth() + 1, 1))
  const out: Pending[] = []
  for (const ym of [cur, next]) {
    const [y, m] = ym.split('-').map(Number)
    for (const e of eventsOf(ym)) {
      if (isPaid(e, ym)) continue
      const inDays = daysUntil(today, y, m, e.day)
      if ((ym === cur && inDays < 0) || (inDays >= 0 && inDays <= windowDays)) out.push({ ...e, ym, inDays })
    }
  }
  out.sort((a, b) => a.inDays - b.inDays || a.label.localeCompare(b.label))
  return { overdue: out.filter((e) => e.inDays < 0), soon: out.filter((e) => e.inDays >= 0) }
}

/** Frase de prazo: "vence amanhã", "venceu há 3 dias"… (d = dias até o vencimento). */
export function dueLabel(d: number): string {
  if (d === 0) return 'vence hoje'
  if (d === 1) return 'vence amanhã'
  if (d > 1) return `vence em ${d} dias`
  return d === -1 ? 'venceu ontem' : `venceu há ${-d} dias`
}
