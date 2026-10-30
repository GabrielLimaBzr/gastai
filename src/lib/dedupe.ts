import type { Tx } from './types'

export const normalizeDesc = (d: string): string =>
  d.toUpperCase().replace(/\s+/g, ' ').trim()

/** Chave estável para importação idempotente (mesma fatura importada 2x não duplica). */
export async function dedupeKey(tx: Tx, occurrence = 0): Promise<string> {
  const raw = [
    tx.occurred_on,
    normalizeDesc(tx.description),
    tx.amount_cents,
    tx.installment_no ?? '',
    tx.installment_total ?? '',
    occurrence, // permite 2 compras idênticas legítimas no mesmo dia
  ].join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
