import type { Tx } from '../types'
import { cents, groupRows, inferDate, INSTALLMENT, MONEY, MONTHS, pagesText, rowText, splitColumns } from './common'
import type { Item, ParsedInvoice, PdfPage } from './types'

const DATE = new RegExp(`^(\\d{2}) (${MONTHS.join('|')})$`)
const LONE_INSTALLMENT = /^(?:\(\d+\)\s*)?(\d{2})\/(\d{2})$/
const SKIP = /^mdte|SALDO ANTERIOR|PAGAMENTO/i

type DueYM = { y: number; m: number }

/**
 * Coluna esquerda ("movimentações" e parcelas): a descrição fica numa linha ACIMA da data
 * e a parcela numa linha ABAIXO — ou tudo inline. Coluna direita: uma linha por compra.
 */
function parseLeft(rows: Item[][], due: DueYM): Tx[] {
  const out: Tx[] = []
  let pending: string | null = null
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const dm = row[0].str.trim().match(DATE)
    if (!dm) {
      if (row.length === 1 && row[0].x >= 60 && row[0].x < 100 && !LONE_INSTALLMENT.test(row[0].str.trim())) pending = row[0].str.trim()
      continue
    }
    let desc: string | null = null
    let value: string | null = null
    let inst: RegExpMatchArray | null = null
    for (const it of row.slice(1)) {
      const s = it.str.trim()
      if (INSTALLMENT.test(s)) inst = s.match(INSTALLMENT)
      else if (MONEY.test(s)) value = s
      else if (!desc && it.x < 125) desc = s
    }
    if (!value) continue
    if (!inst && i + 1 < rows.length) {
      const next = rowText(rows[i + 1]).match(LONE_INSTALLMENT)
      if (next) inst = next
    }
    const description = desc ?? pending ?? '(sem descrição)'
    pending = null
    if (SKIP.test(description)) continue
    out.push({
      occurred_on: inferDate(+dm[1], MONTHS.indexOf(dm[2]) + 1, due),
      description,
      amount_cents: cents(value),
      installment_no: inst ? +inst[1] : null,
      installment_total: inst ? +inst[2] : null,
    })
  }
  return out
}

function parseRight(rows: Item[][], due: DueYM): Tx[] {
  const out: Tx[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const dm = row[0].str.trim().match(DATE)
    if (!dm || row.length < 2) continue
    let value = [...row].reverse().find((it) => MONEY.test(it.str.trim()))?.str
    if (!value) {
      // compra no exterior: o valor em R$ vem em linhas logo abaixo
      for (const next of rows.slice(i + 1, i + 4)) {
        const m = next.find((it) => /^-?R\$/.test(it.str.trim()) && MONEY.test(it.str.trim()))
        if (m) { value = m.str; break }
      }
    }
    if (!value) continue
    out.push({
      occurred_on: inferDate(+dm[1], MONTHS.indexOf(dm[2]) + 1, due),
      description: row[1].str.trim(),
      amount_cents: cents(value),
      installment_no: null,
      installment_total: null,
    })
  }
  return out
}

export function parseCresol(pages: PdfPage[]): ParsedInvoice {
  const text = pagesText(pages)
  const due = text.match(new RegExp(`VENCIMENTO\\s+(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(20\\d{2})`))
  const total = text.match(/SALDO TOTAL\s*=\s*(\d[\d.]*,\d{2})/)
  const dueYM: DueYM = due ? { y: +due[3], m: MONTHS.indexOf(due[2]) + 1 } : { y: new Date().getFullYear(), m: 12 }

  const txs: Tx[] = []
  for (const page of pages) {
    const [left, right] = splitColumns(page)
    txs.push(...parseLeft(groupRows(left), dueYM), ...parseRight(groupRows(right), dueYM))
  }

  return {
    bank: 'cresol',
    dueDate: due ? `${due[3]}-${String(dueYM.m).padStart(2, '0')}-${due[1].padStart(2, '0')}` : null,
    statementTotalCents: total ? cents(total[1]) : null,
    txs,
  }
}
