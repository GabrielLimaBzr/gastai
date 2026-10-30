import { categoryOf, OTHER, flexOf } from './categorize'
import { merchantOf } from './anomalies'
import { txMonth } from './money'

export interface LedgerRow {
  id: string
  occurred_on: string
  billed_month: string | null
  description: string
  amount_cents: number
  installment_no: number | null
  installment_total: number | null
  category_id: string | null
  account_id: string | null
}

/** confirmed = o usuário escolheu · suggested = palpite por palavra-chave · none = sem nenhuma pista */
export type CatState = 'confirmed' | 'suggested' | 'none'
export interface CatInfo { name: string; state: CatState }

export function categorize(description: string, chosenName?: string | null): CatInfo {
  if (chosenName) return { name: chosenName, state: 'confirmed' }
  const auto = categoryOf(description)
  return auto ? { name: auto.name, state: 'suggested' } : { name: OTHER, state: 'none' }
}

export interface Slice { key: string; cents: number; count: number }

export function groupSum<T>(rows: T[], key: (r: T) => string, cents: (r: T) => number): Slice[] {
  const m = new Map<string, Slice>()
  for (const r of rows) {
    const k = key(r)
    const cur = m.get(k) ?? { key: k, cents: 0, count: 0 }
    cur.cents += cents(r)
    cur.count += 1
    m.set(k, cur)
  }
  return [...m.values()].sort((a, b) => b.cents - a.cents)
}

export const sumCents = (rows: { amount_cents: number }[]) => rows.reduce((s, r) => s + r.amount_cents, 0)

export const monthsDesc = (rows: LedgerRow[]) => [...new Set(rows.map(txMonth))].sort().reverse()

export function addMonths(ym: string, k: number): string {
  const [y, m] = ym.split('-').map(Number)
  const i = y * 12 + (m - 1) + k
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

export const merchantKey = (description: string) => merchantOf(description) || description.toUpperCase()

/**
 * Parcelas que ainda vão cair: para cada compra parcelada da fatura de `baseMonth`,
 * projeta as parcelas restantes (mesmo valor) nos meses seguintes.
 */
export function futureInstallments(rows: LedgerRow[], baseMonth: string, horizon = 6): { month: string; cents: number }[] {
  const out = new Map<string, number>()
  for (const r of rows) {
    if (txMonth(r) !== baseMonth || !r.installment_total || !r.installment_no || r.amount_cents <= 0) continue
    const left = r.installment_total - r.installment_no
    for (let k = 1; k <= left && k <= horizon; k++) {
      const m = addMonths(baseMonth, k)
      out.set(m, (out.get(m) ?? 0) + r.amount_cents)
    }
  }
  return Array.from({ length: horizon }, (_, i) => addMonths(baseMonth, i + 1)).map((month) => ({ month, cents: out.get(month) ?? 0 }))
}

/** Quanto do total é "cortável" (categorias flexíveis). */
export const flexibleCents = (slices: Slice[]) =>
  slices.filter((s) => flexOf(s.key) === 'flexible').reduce((a, s) => a + s.cents, 0)
