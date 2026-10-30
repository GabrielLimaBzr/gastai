import { describe, it, expect } from 'vitest'
import { detectAnomalies } from '../src/lib/anomalies'
import { toCents } from '../src/lib/money'
import { parseGenericInvoice } from '../src/lib/pdfInvoice'
import { parseNotionCsv } from '../src/lib/notionCsv'

const tx = (d: string, desc: string, cents: number) => ({ occurred_on: d, description: desc, amount_cents: cents })

describe('money', () => {
  it('parseia pt-BR', () => {
    expect(toCents('R$ 1.234,56')).toBe(123456)
    expect(toCents('10,5')).toBe(1050)
  })
})

describe('anomalias', () => {
  it('detecta duplicata', () => {
    const a = detectAnomalies([tx('2026-01-02', 'UBER *TRIP', 2500), tx('2026-01-02', 'UBER *TRIP', 2500)])
    expect(a.map((x) => x.kind)).toContain('duplicate')
  })
  it('detecta mudança de preço em assinatura', () => {
    const a = detectAnomalies([
      tx('2026-01-05', 'NETFLIX', 5590), tx('2026-02-05', 'NETFLIX', 5590),
      tx('2026-03-05', 'NETFLIX', 5590), tx('2026-04-05', 'NETFLIX', 7990),
    ])
    expect(a.map((x) => x.kind)).toContain('price_change')
  })
  it('detecta pico', () => {
    const a = detectAnomalies([
      tx('2026-01-01', 'MERCADO X', 10000), tx('2026-02-01', 'MERCADO X', 11000),
      tx('2026-03-01', 'MERCADO X', 9500), tx('2026-04-01', 'MERCADO X', 10500),
      tx('2026-05-01', 'MERCADO X', 60000),
    ])
    expect(a.map((x) => x.kind)).toContain('spike')
  })
})

describe('parsers', () => {
  it('fatura com parcela', () => {
    const r = parseGenericInvoice(['15/03 LOJA ABC 02/10 199,90', 'lixo'], 2026)
    expect(r).toEqual([{ occurred_on: '2026-03-15', description: 'LOJA ABC', amount_cents: 19990, installment_no: 2, installment_total: 10 }])
  })
  it('csv notion', () => {
    const r = parseNotionCsv('Nome,Valor,Data,Categoria\nAluguel,"1.500,00",05/03/2026,Moradia')
    expect(r[0]).toMatchObject({ description: 'Aluguel', amount_cents: 150000, occurred_on: '2026-03-05', category_name: 'Moradia' })
  })
})

import { categoryOf } from '../src/lib/categorize'
import { analyze } from '../src/lib/analysis'
import { parseNubankCsv, isNubankCsv } from '../src/lib/nubankCsv'

describe('categorização e análise', () => {
  it('categoriza por palavra-chave', () => {
    expect(categoryOf('IFD*PADARIA X')?.name).toBe('Delivery e restaurantes')
    expect(categoryOf('DL*UberRidesV')?.name).toBe('Transporte por app')
    expect(categoryOf('99*')?.name).toBe('Transporte por app')
    expect(categoryOf('LOJA QUALQUER')).toBeNull()
  })
  it('ranqueia categorias e soma o flexível', () => {
    const a = analyze([
      { occurred_on: '2026-09-01', description: 'IFD*A', amount_cents: 5000 },
      { occurred_on: '2026-09-02', description: 'IFD*A', amount_cents: 5000 },
      { occurred_on: '2026-09-03', description: 'MATEUS SUPERMERCADOS', amount_cents: 20000 },
      { occurred_on: '2026-09-04', description: 'ESTORNO', amount_cents: -1000 },
    ])
    expect(a.total).toBe(30000)
    expect(a.byCategory[0].name).toBe('Supermercado')
    expect(a.flexibleTotal).toBe(10000)
  })
  it('parseia csv do nubank ignorando pagamento recebido', () => {
    const csv = 'date,title,amount\n2026-09-02,Pix no Crédito - Fulano - 2/2,"36,64"\n2026-09-02,Pagamento recebido,"- 997,11"\n'
    expect(isNubankCsv(csv)).toBe(true)
    expect(parseNubankCsv(csv)).toEqual([
      { occurred_on: '2026-09-02', description: 'Pix no Crédito - Fulano', amount_cents: 3664, installment_no: 2, installment_total: 2 },
    ])
  })
})
