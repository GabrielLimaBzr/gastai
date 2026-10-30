import Papa from 'papaparse'
import { toCents } from './money'
import type { Tx } from './types'

/**
 * Importa o CSV exportado do Notion (Export > Markdown & CSV).
 * Colunas esperadas (nomes flexíveis): Nome/Descrição, Valor, Data, Categoria.
 */
export interface NotionRow extends Tx { category_name?: string }

const pick = (row: Record<string, string>, names: string[]) => {
  const key = Object.keys(row).find((k) => names.includes(k.trim().toLowerCase()))
  return key ? row[key] : ''
}

const toIso = (s: string): string => {
  const br = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const d = new Date(s)
  return isNaN(+d) ? '' : d.toISOString().slice(0, 10)
}

export function parseNotionCsv(text: string): NotionRow[] {
  const { data } = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return data
    .map((r) => ({
      description: pick(r, ['nome', 'descrição', 'descricao', 'name', 'gasto']),
      amount_cents: toCents(pick(r, ['valor', 'value', 'amount']) || '0'),
      occurred_on: toIso(pick(r, ['data', 'date'])),
      category_name: pick(r, ['categoria', 'category', 'tipo']) || undefined,
    }))
    .filter((r) => r.description && r.occurred_on && !Number.isNaN(r.amount_cents))
}
