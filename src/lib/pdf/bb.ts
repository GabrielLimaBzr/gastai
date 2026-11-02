import type { Tx } from '../types'
import { cents, groupRows, pagesText, rowText } from './common'
import type { ParsedInvoice, PdfPage } from './types'

/**
 * Banco do Brasil (Ourocard). Layout esperado: uma lista só, uma linha por lançamento:
 *   DD/MM  DESCRIÇÃO  [PARC NN/NN]  [PAÍS]  valor[-| CR]
 * Estornos/pagamentos vêm com sinal de menos (antes ou depois do valor) ou "CR".
 * O total declarado é conferido na tela de importação: se a soma não bater, o app avisa.
 */
const ROW = /^(\d{2})\/(\d{2})(?:\/\d{2,4})?\s+(.+?)\s+(-?\s?\d[\d.]*,\d{2})\s?(-|CR)?$/i
const INSTALLMENT = /(?:\bPARC(?:ELA)?\.?\s*)?\b(\d{1,2})\s*(?:\/|DE)\s*(\d{1,2})\b/i
const NOT_SPENDING = /PAGAMENTO|PGTO|SALDO\s+(FATURA\s+)?ANTERIOR|TOTAL\s+DA\s+FATURA|CR[ÉE]DITO\s+DE\s+FATURA/i
const COUNTRY = /\s+(BR|BRA|US|USA|[A-Z]{2})$/

function inferDate(day: number, month: number, due: { y: number; m: number }): string {
  const y = month > due.m ? due.y - 1 : due.y
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseBB(pages: PdfPage[]): ParsedInvoice {
  const text = pagesText(pages)
  const due = text.match(/Vencimento[\s\S]{0,60}?(\d{2})\/(\d{2})\/(20\d{2})/i)
  const total = text.match(/(?:Total\s+da\s+Fatura|Valor\s+Total\s+da\s+Fatura|Total\s+a\s+Pagar)[\s\S]{0,40}?(\d[\d.]*,\d{2})/i)
  const dueYM = due ? { y: +due[3], m: +due[2] } : { y: new Date().getFullYear(), m: 12 }

  const txs: Tx[] = []
  for (const page of pages) {
    for (const row of groupRows(page.items)) {
      const m = rowText(row).match(ROW)
      if (!m) continue
      let description = m[3].trim()
      if (NOT_SPENDING.test(description)) continue
      let no: number | null = null
      let of: number | null = null
      const inst = description.match(INSTALLMENT)
      if (inst && +inst[2] > 1 && +inst[1] <= +inst[2]) {
        no = +inst[1]; of = +inst[2]
        description = description.replace(inst[0], '').trim()
      }
      description = description.replace(COUNTRY, '').replace(/\s+/g, ' ').trim()
      if (!description) continue
      let value = cents(m[4])
      if (m[5]) value = -Math.abs(value) // "-" depois do valor ou "CR": crédito/estorno
      txs.push({ occurred_on: inferDate(+m[1], +m[2], dueYM), description, amount_cents: value, installment_no: no, installment_total: of })
    }
  }

  return { bank: 'bb', dueDate: due ? `${due[3]}-${due[2]}-${due[1]}` : null, statementTotalCents: total ? cents(total[1]) : null, txs }
}
