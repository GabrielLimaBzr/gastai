import { parseGenericInvoice } from '../pdfInvoice'
import { groupRows, pagesText, rowText } from './common'
import { parseCresol } from './cresol'
import { parseSantander } from './santander'
import type { ParsedInvoice, PdfPage } from './types'

export type { ParsedInvoice, PdfPage } from './types'

/** Detecta o banco pelo conteúdo e usa o parser dedicado; senão cai no genérico. */
export function parseInvoice(pages: PdfPage[], fallbackYear: number): ParsedInvoice {
  const text = pagesText(pages)
  if (/CRESOL/i.test(text) && /LAN[ÇC]AMENTOS/.test(text)) return parseCresol(pages)
  if (/santander/i.test(text) && /Detalhamento da Fatura/.test(text)) return parseSantander(pages)

  const lines = pages.flatMap((p) => groupRows(p.items).map(rowText))
  return { bank: 'generic', dueDate: null, statementTotalCents: null, txs: parseGenericInvoice(lines, fallbackYear) }
}
