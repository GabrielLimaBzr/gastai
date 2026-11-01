import { txMonth } from './money'
import type { LedgerRow } from './ledger'

export type ByMonth = Map<string, Map<string, number>> // mês → categoria → centavos (líquido: estorno abate)

export function categoryByMonth(rows: LedgerRow[], nameOf: (r: LedgerRow) => string): ByMonth {
  const out: ByMonth = new Map()
  for (const r of rows) {
    const m = txMonth(r)
    const cats = out.get(m) ?? new Map<string, number>()
    const name = nameOf(r)
    cats.set(name, (cats.get(name) ?? 0) + r.amount_cents)
    out.set(m, cats)
  }
  return out
}

export interface Delta { name: string; cur: number; prev: number; delta: number; pct: number | null }

/** Mês atual contra o anterior, por categoria. `pct` é null quando não havia gasto antes (categoria nova). */
export function compareMonths(cur: Map<string, number> | undefined, prev: Map<string, number> | undefined): Delta[] {
  const names = new Set([...(cur?.keys() ?? []), ...(prev?.keys() ?? [])])
  return [...names]
    .map((name) => {
      const c = Math.max(cur?.get(name) ?? 0, 0), p = Math.max(prev?.get(name) ?? 0, 0)
      return { name, cur: c, prev: p, delta: c - p, pct: p > 0 ? (c - p) / p : null }
    })
    .filter((d) => d.cur > 0 || d.prev > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

/** Valores de uma categoria mês a mês, na ordem de `months` (0 quando não houve gasto). */
export const categorySeries = (byMonth: ByMonth, months: string[], name: string): number[] =>
  months.map((m) => Math.max(byMonth.get(m)?.get(name) ?? 0, 0))
