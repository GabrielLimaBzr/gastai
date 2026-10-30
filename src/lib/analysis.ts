import type { Tx } from './types'
import { categoryOf, OTHER } from './categorize'
import { merchantOf } from './anomalies'

export interface Slice { name: string; cents: number; count: number; pct: number }

export interface Analysis {
  total: number
  byCategory: (Slice & { flex: 'essential' | 'flexible' })[]
  topMerchants: Slice[]
  flexibleTotal: number
}

const rank = (m: Map<string, { cents: number; count: number }>, total: number): Slice[] =>
  [...m]
    .map(([name, v]) => ({ name, ...v, pct: total ? v.cents / total : 0 }))
    .sort((a, b) => b.cents - a.cents)

/** Analisa só gastos (valores positivos). Estornos/pagamentos ficam de fora. */
export function analyze(txs: Tx[]): Analysis {
  const spent = txs.filter((t) => t.amount_cents > 0)
  const total = spent.reduce((s, t) => s + t.amount_cents, 0)
  const cats = new Map<string, { cents: number; count: number }>()
  const flexOf = new Map<string, 'essential' | 'flexible'>()
  const merchants = new Map<string, { cents: number; count: number }>()

  for (const t of spent) {
    const c = categoryOf(t.description)
    const name = c?.name ?? OTHER
    flexOf.set(name, c?.flex ?? 'flexible')
    const cur = cats.get(name) ?? { cents: 0, count: 0 }
    cats.set(name, { cents: cur.cents + t.amount_cents, count: cur.count + 1 })

    const m = merchantOf(t.description) || t.description
    const mc = merchants.get(m) ?? { cents: 0, count: 0 }
    merchants.set(m, { cents: mc.cents + t.amount_cents, count: mc.count + 1 })
  }

  const byCategory = rank(cats, total).map((s) => ({ ...s, flex: flexOf.get(s.name)! }))
  return {
    total,
    byCategory,
    topMerchants: rank(merchants, total).slice(0, 10),
    flexibleTotal: byCategory.filter((c) => c.flex === 'flexible').reduce((s, c) => s + c.cents, 0),
  }
}
