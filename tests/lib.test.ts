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

import { toCsv } from '../src/lib/exportCsv'
import { effectiveCategory } from '../src/lib/categorize'

describe('categoria editável e exportação', () => {
  it('escolha do usuário vence a automática', () => {
    expect(effectiveCategory('IFD*PADARIA', null)).toBe('Delivery e restaurantes')
    expect(effectiveCategory('IFD*PADARIA', 'Padaria do dia a dia')).toBe('Padaria do dia a dia')
  })
  it('análise usa a categoria escolhida', () => {
    const a = analyze([{ occurred_on: '2026-09-01', description: 'IFD*A', amount_cents: 5000 }], () => 'Trabalho')
    expect(a.byCategory[0]).toMatchObject({ name: 'Trabalho', flex: 'essential' })
  })
  it('exporta CSV que o próprio app reimporta', () => {
    const csv = toCsv([{ occurred_on: '2026-09-02', description: 'Loja; "X"', amount_cents: 123456, installment_no: 2, installment_total: 3, billed_month: '2026-10-01', category: 'Compras' }])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(parseNotionCsv(csv)[0]).toMatchObject({ description: 'Loja; "X"', amount_cents: 123456, occurred_on: '2026-09-02', category_name: 'Compras' })
  })
})

import { categorize, futureInstallments, groupSum, addMonths } from '../src/lib/ledger'

describe('ledger', () => {
  it('distingue confirmada, sugerida e sem categoria', () => {
    expect(categorize('IFD*X', 'Trabalho')).toEqual({ name: 'Trabalho', state: 'confirmed' })
    expect(categorize('IFD*X')).toEqual({ name: 'Delivery e restaurantes', state: 'suggested' })
    expect(categorize('LOJA QUALQUER')).toEqual({ name: 'Outros', state: 'none' })
  })
  it('soma por chave', () => {
    const r = groupSum([{ k: 'a', v: 5 }, { k: 'b', v: 9 }, { k: 'a', v: 7 }], (x) => x.k, (x) => x.v)
    expect(r).toEqual([{ key: 'a', cents: 12, count: 2 }, { key: 'b', cents: 9, count: 1 }])
  })
  it('soma meses atravessando o ano', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })
  it('projeta parcelas restantes nos meses seguintes', () => {
    const base = { occurred_on: '2026-08-03', billed_month: '2026-10-01', category_id: null, account_id: null }
    const rows = [
      { ...base, id: '1', description: 'A', amount_cents: 1000, installment_no: 2, installment_total: 4 }, // faltam 2
      { ...base, id: '2', description: 'B', amount_cents: 500, installment_no: 3, installment_total: 3 }, // quitada
      { ...base, id: '3', description: 'C', amount_cents: 300, installment_no: null, installment_total: null },
    ]
    const f = futureInstallments(rows, '2026-10', 3)
    expect(f).toEqual([{ month: '2026-11', cents: 1000 }, { month: '2026-12', cents: 1000 }, { month: '2027-01', cents: 0 }])
  })
})
