export const toCents = (v: string | number): number => {
  if (typeof v === 'number') return Math.round(v * 100)
  const s = v.replace(/[R$\s]/g, '')
  // "1.234,56" (pt-BR) ou "1234.56"
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  return Math.round(parseFloat(norm) * 100)
}

export const brl = (cents: number): string =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const monthKey = (iso: string): string => iso.slice(0, 7)
