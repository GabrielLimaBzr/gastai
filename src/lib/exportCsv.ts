import Papa from 'papaparse'

export interface ExportRow {
  occurred_on: string
  description: string
  amount_cents: number
  installment_no?: number | null
  installment_total?: number | null
  billed_month?: string | null
  category: string
}

const brNumber = (cents: number) => (cents / 100).toFixed(2).replace('.', ',')

/**
 * CSV para Excel pt-BR (separador ';', decimal com vírgula, BOM).
 * Os nomes das colunas são os mesmos que o importador do Notion reconhece: dá para reimportar.
 */
export function toCsv(rows: ExportRow[]): string {
  const data = rows.map((r) => ({
    Data: r.occurred_on,
    'Descrição': r.description,
    Valor: brNumber(r.amount_cents),
    Categoria: r.category,
    Parcela: r.installment_total ? `${r.installment_no}/${r.installment_total}` : '',
    'Mês da fatura': r.billed_month?.slice(0, 7) ?? '',
  }))
  return '\uFEFF' + Papa.unparse(data, { delimiter: ';' })
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}
