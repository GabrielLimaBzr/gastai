import { toCents } from '../money'
import type { Item, PdfPage } from './types'

export const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
export const MONEY = /^-?\s*(R\$)?\s*-?\d[\d.]*,\d{2}$/
export const INSTALLMENT = /^(\d{2})\/(\d{2})$/

export const cents = (s: string): number => toCents(s.replace(/R\$|\s/g, ''))

/** Agrupa textos na mesma linha visual (y próximo), ordenados da esquerda p/ direita. */
export function groupRows(items: Item[], tol = 3): Item[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: Item[][] = []
  let top = Infinity
  for (const it of sorted) {
    if (rows.length && top - it.y <= tol) rows[rows.length - 1].push(it)
    else { rows.push([it]); top = it.y }
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x))
}

/** Faturas em duas colunas: separa pelo x para não misturar as linhas. */
export function splitColumns(page: PdfPage, splitX = 300): [Item[], Item[]] {
  return [page.items.filter((i) => i.x < splitX), page.items.filter((i) => i.x >= splitX)]
}

export const rowText = (row: Item[]): string => row.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()

export const pagesText = (pages: PdfPage[]): string =>
  pages.map((p) => groupRows(p.items).map(rowText).join('\n')).join('\n')

/** Fatura só traz dia/mês: o ano vem do vencimento (mês maior que o do vencimento = ano anterior). */
export function inferDate(day: number, month: number, due: { y: number; m: number }): string {
  const y = month > due.m ? due.y - 1 : due.y
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
