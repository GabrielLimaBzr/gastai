import Papa from 'papaparse'
import { toCents } from './money'
import type { Tx } from './types'

/** CSV da fatura do Nubank: date,title,amount (vírgula decimal; pagamentos vêm negativos). */
export const isNubankCsv = (text: string) => /^\s*date,title,amount/i.test(text)

export function parseNubankCsv(text: string): Tx[] {
  const { data } = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true })
  return data
    .filter((r) => r.date && r.title && !/^pagamento recebido/i.test(r.title))
    .map((r) => {
      const inst = r.title.match(/\s-\s(\d+)\/(\d+)$/)
      return {
        occurred_on: r.date,
        description: (inst ? r.title.slice(0, inst.index) : r.title).trim(),
        amount_cents: toCents(r.amount),
        installment_no: inst ? +inst[1] : null,
        installment_total: inst ? +inst[2] : null,
      }
    })
}
