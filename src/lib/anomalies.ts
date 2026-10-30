import type { Anomaly, Tx } from './types'
import { normalizeDesc } from './dedupe'
import { brl } from './money'

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
const std = (a: number[]) => {
  const m = mean(a)
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)))
}

/** Remove sufixos de parcela/ruído para agrupar o mesmo estabelecimento. */
export const merchantOf = (desc: string): string =>
  normalizeDesc(desc).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\b\d{1,2}\/\d{1,2}\b/g, '').replace(/[^A-Z ]/g, '').trim()

export function detectAnomalies(txs: Tx[], opts = { highCents: 30000, zScore: 2.5 }): Anomaly[] {
  const out: Anomaly[] = []
  const spent = txs.filter((t) => t.amount_cents > 0)

  // 1. Cobrança duplicada: mesmo dia + mesmo estabelecimento + mesmo valor (sem parcelas)
  const seen = new Map<string, Tx>()
  for (const t of spent) {
    if (t.installment_total) continue
    const k = `${t.occurred_on}|${merchantOf(t.description)}|${t.amount_cents}`
    if (seen.has(k)) out.push({ kind: 'duplicate', tx: t, message: `Possível cobrança duplicada: ${t.description} ${brl(t.amount_cents)}` })
    else seen.set(k, t)
  }

  const byMerchant = new Map<string, Tx[]>()
  for (const t of spent) {
    const m = merchantOf(t.description)
    byMerchant.set(m, [...(byMerchant.get(m) ?? []), t])
  }

  for (const [m, list] of byMerchant) {
    const sorted = [...list].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
    const last = sorted[sorted.length - 1]
    const prev = sorted.slice(0, -1).map((t) => t.amount_cents)

    // 2. Estabelecimento novo com valor alto
    if (sorted.length === 1 && last.amount_cents >= opts.highCents)
      out.push({ kind: 'new_merchant_high', tx: last, message: `Primeira compra em ${m} já é alta: ${brl(last.amount_cents)}` })

    if (prev.length >= 3) {
      // 3. Valor muito acima do histórico do estabelecimento
      const s = std(prev)
      if (s > 0 && (last.amount_cents - mean(prev)) / s > opts.zScore)
        out.push({ kind: 'spike', tx: last, message: `${m}: ${brl(last.amount_cents)} vs média ${brl(Math.round(mean(prev)))}` })
      // 4. Assinatura que mudou de preço (valores estáveis e o último difere)
      else if (s === 0 && prev[0] !== last.amount_cents)
        out.push({ kind: 'price_change', tx: last, message: `${m} mudou de ${brl(prev[0])} para ${brl(last.amount_cents)}` })
    }
  }
  return out
}
