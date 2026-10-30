import { describe, it, expect } from 'vitest'
import { parseInvoice } from '../src/lib/pdf'
import type { PdfPage } from '../src/lib/pdf'

const t = (x: number, y: number, str: string) => ({ x, y, str })

// Santander: duas colunas (x<300 / x>=300), linha "DD/MM DESC [NN/NN] valor", dígito do cartão solto à esquerda
const santander: PdfPage[] = [
  { items: [t(10, 710, 'cartão SANTANDER ELITE'), t(10, 700, 'Total a Pagar'), t(100, 700, 'Vencimento'), t(10, 690, 'R$ 1.000,00'), t(100, 690, '10/10/2026')] },
  {
    items: [
      t(14, 537, 'Detalhamento da Fatura'),
      t(33, 472, '03/09 PAGAMENTO DE FATURA-INTERNET'), t(201, 472, '-500,00'),
      t(17, 427, '3'), t(33, 426, '19/09 LOJA TESTE'), t(168, 426, '01/02'), t(208, 426, '204,96'),
      t(17, 381, '3'), t(33, 380, '04/09 RESTAURANTE X'), t(208, 380, '127,00'),
      t(327, 390, '10/02 LOJA ANTIGA'), t(462, 390, '08/08'), t(501, 390, '196,53'),
      t(327, 300, '13/08 ESTORNO LOJA'), t(507, 300, '-0,05'),
      t(327, 280, 'VALOR TOTAL'), t(497, 280, '1.524,70'),
      t(326, 261, '(=) Saldo Desta Fatura'), t(495, 261, '528,40'),
    ],
  },
]

// Cresol: esquerda = descrição ACIMA da data e parcela ABAIXO; direita = uma linha por compra
const cresol: PdfPage[] = [
  { items: [t(100, 700, 'CRESOL TESTE'), t(100, 690, 'VENCIMENTO'), t(200, 690, '7 OUT 2026'), t(100, 600, 'SALDO TOTAL'), t(200, 600, '= 469,10')] },
  {
    items: [
      t(21, 755, 'LANÇAMENTOS - CRESOL MASTERCARD'),
      t(68, 563, 'LOJA PARCELADA'),
      t(28, 559, '28 JUN'), t(176, 559, 'Cascavel'), t(242, 559, 'R$ 88,66'),
      t(68, 555, '03/03'),
      t(28, 540, '08 AGO'), t(68, 540, 'IMAGINARIUM'), t(132, 540, '02/02'), t(176, 540, 'SAO LUIS'), t(242, 540, 'R$ 89,95'),
      t(305, 717, '17 SET'), t(345, 717, 'DL*UberRidesV'), t(452, 717, 'Sao Paulo'), t(519, 717, 'R$ 10,98'),
      t(305, 645, '19 SET'), t(345, 645, 'ANTHROPIC* CLAUDE SU'), t(442, 645, 'SAN FRANCISCO'),
      t(345, 631, 'R$ 110,00'), t(381, 631, 'U$ 21,39'), t(517, 627, 'R$ 110,00'),
      t(28, 500, '08 SET'), t(68, 500, 'mdte20260908-1'), t(237, 500, '-R$ 400,00'),
      t(28, 480, '19 SET'), t(68, 480, 'IOF OPERACAO EXTERIOR'), t(244, 480, 'R$ 3,85'),
      t(68, 460, 'SALDO ANTERIOR'), t(238, 460, 'R$ 400,00'),
    ],
  },
]

const sum = (r: { txs: { amount_cents: number }[] }) => r.txs.reduce((s, x) => s + x.amount_cents, 0)

describe('parser Santander', () => {
  const r = parseInvoice(santander, 2026)
  it('lê vencimento e total declarado', () => {
    expect(r.bank).toBe('santander')
    expect(r.dueDate).toBe('2026-10-10')
    expect(r.statementTotalCents).toBe(52840)
  })
  it('ignora pagamento, separa colunas e mantém parcelas e estornos', () => {
    expect(r.txs.map((x) => x.description)).toEqual(['LOJA TESTE', 'RESTAURANTE X', 'LOJA ANTIGA', 'ESTORNO LOJA'])
    expect(r.txs[0]).toMatchObject({ occurred_on: '2026-09-19', amount_cents: 20496, installment_no: 1, installment_total: 2 })
    expect(r.txs[2]).toMatchObject({ occurred_on: '2026-02-10', installment_no: 8, installment_total: 8 })
    expect(r.txs[3].amount_cents).toBe(-5)
  })
})

describe('parser Cresol', () => {
  const r = parseInvoice(cresol, 2026)
  it('lê vencimento e total', () => {
    expect(r.bank).toBe('cresol')
    expect(r.dueDate).toBe('2026-10-07')
    expect(r.statementTotalCents).toBe(46910)
  })
  it('resolve descrição acima, parcela abaixo/inline, compra no exterior e ignora pagamento', () => {
    const by = (d: string) => r.txs.find((x) => x.description === d)!
    expect(by('LOJA PARCELADA')).toMatchObject({ occurred_on: '2026-06-28', amount_cents: 8866, installment_no: 3, installment_total: 3 })
    expect(by('IMAGINARIUM')).toMatchObject({ amount_cents: 8995, installment_no: 2, installment_total: 2 })
    expect(by('ANTHROPIC* CLAUDE SU').amount_cents).toBe(11000)
    expect(r.txs.some((x) => /mdte|SALDO/i.test(x.description))).toBe(false)
  })
  it('soma dos lançamentos = total declarado', () => {
    expect(sum(r)).toBe(8866 + 8995 + 1098 + 11000 + 385)
  })
})

describe('banco desconhecido', () => {
  it('cai no parser genérico', () => {
    const r = parseInvoice([{ items: [t(10, 10, '15/03 LOJA ABC 199,90')] }], 2026)
    expect(r.bank).toBe('generic')
    expect(r.txs[0].amount_cents).toBe(19990)
  })
})
