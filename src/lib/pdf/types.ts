import type { Tx } from '../types'

export interface Item { x: number; y: number; str: string }
export interface PdfPage { items: Item[] }

export type Bank = 'santander' | 'cresol' | 'generic'

export interface ParsedInvoice {
  bank: Bank
  /** Vencimento da fatura (YYYY-MM-DD); define o mês em que o dinheiro sai. */
  dueDate: string | null
  /** Total declarado na fatura, para conferir com a soma dos lançamentos. */
  statementTotalCents: number | null
  txs: Tx[]
}
