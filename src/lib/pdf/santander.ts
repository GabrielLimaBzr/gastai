import type { Tx } from '../types'
import { cents, groupRows, inferDate, pagesText, rowText, splitColumns } from './common'
import type { ParsedInvoice, PdfPage } from './types'

// [card] DD/MM  DESCRIÇÃO  [NN/NN]  valor  [US$]
const ROW = /^(?:\d\s+)?(\d{2})\/(\d{2})\s+(.+?)(?:\s+(\d{2})\/(\d{2}))?\s+(-?\d[\d.]*,\d{2})(?:\s+\d[\d.]*,\d{2})?$/

export function parseSantander(pages: PdfPage[]): ParsedInvoice {
  const text = pagesText(pages)
  const due = text.match(/Vencimento[\s\S]{0,160}?(\d{2})\/(\d{2})\/(20\d{2})/)
  const total = text.match(/Saldo Desta Fatura[\s\S]{0,40}?(\d[\d.]*,\d{2})/)
  const dueYM = due ? { y: +due[3], m: +due[2] } : { y: new Date().getFullYear(), m: 12 }

  const txs: Tx[] = []
  for (const page of pages) {
    if (!/Detalhamento da Fatura|Pagamento e Demais Cr/.test(pagesText([page]))) continue
    for (const col of splitColumns(page)) {
      for (const row of groupRows(col)) {
        const m = rowText(row).match(ROW)
        if (!m) continue
        const description = m[3].trim()
        if (/PAGAMENTO/i.test(description)) continue // pagamento da fatura anterior não é gasto
        txs.push({
          occurred_on: inferDate(+m[1], +m[2], dueYM),
          description,
          amount_cents: cents(m[6]),
          installment_no: m[4] ? +m[4] : null,
          installment_total: m[5] ? +m[5] : null,
        })
      }
    }
  }

  return {
    bank: 'santander',
    dueDate: due ? `${due[3]}-${due[2]}-${due[1]}` : null,
    statementTotalCents: total ? cents(total[1]) : null,
    txs,
  }
}
