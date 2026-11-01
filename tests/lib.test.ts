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

import { bucketBy } from '../src/lib/ledger'

describe('bucketBy', () => {
  it('agrupa mantendo a ordem', () => {
    const m = bucketBy([{ k: 'a', n: 1 }, { k: 'b', n: 2 }, { k: 'a', n: 3 }], (x) => x.k)
    expect(m.get('a')!.map((x) => x.n)).toEqual([1, 3])
    expect([...m.keys()]).toEqual(['a', 'b'])
  })
})

import { endingSchedule, futureDetail } from '../src/lib/ledger'

describe('parcelas futuras detalhadas', () => {
  const base = { occurred_on: '2026-08-03', billed_month: '2026-10-01', category_id: null, account_id: 'c1' }
  const rows = [
    { ...base, id: '1', description: 'BMB', amount_cents: 1000, installment_no: 2, installment_total: 4 },
    { ...base, id: '2', description: 'LOJA', amount_cents: 300, installment_no: 1, installment_total: 2 },
    { ...base, id: '3', description: 'QUITADA', amount_cents: 500, installment_no: 3, installment_total: 3 },
  ]
  it('lista as compras e o número da parcela em cada mês', () => {
    const f = futureDetail(rows, '2026-10', 3)
    expect(f.map((m) => [m.month, m.cents])).toEqual([['2026-11', 1300], ['2026-12', 1000], ['2027-01', 0]])
    expect(f[0].items.map((i) => [i.row.description, i.no, i.total])).toEqual([['BMB', 3, 4], ['LOJA', 2, 2]])
  })
  it('diz quando cada parcelamento termina e quanto falta', () => {
    const e = endingSchedule(rows, '2026-10')
    expect(e.map((x) => [x.row.description, x.left, x.endMonth, x.remainingCents])).toEqual([['LOJA', 1, '2026-11', 300], ['BMB', 2, '2026-12', 2000]])
  })
})

import { accountMatchesBank, matchAccount, nubankBilledMonth } from '../src/lib/bank'

describe('banco x cartão', () => {
  const accs = [{ id: '1', name: 'Cresol' }, { id: '2', name: 'Santander Elite' }, { id: '3', name: 'Cartão Nubank Roxinho' }]
  it('acha o cartão pelo banco da fatura', () => {
    expect(matchAccount(accs, 'nubank')?.id).toBe('3')
    expect(matchAccount(accs, 'santander')?.id).toBe('2')
    expect(matchAccount(accs, 'cresol')?.id).toBe('1')
    expect(matchAccount([{ id: '1', name: 'Cresol' }], 'nubank')).toBeUndefined() // não cai no 1º da lista
    expect(matchAccount(accs, 'generic')).toBeUndefined()
  })
  it('detecta cartão que não combina com o banco', () => {
    expect(accountMatchesBank('Cresol', 'nubank')).toBe(false)
    expect(accountMatchesBank('NUBANK', 'nubank')).toBe(true)
  })
  it('mês da fatura do Nubank vem do nome do arquivo', () => {
    expect(nubankBilledMonth('Nubank_2026-11-09.csv', [])).toBe('2026-11')
    expect(nubankBilledMonth('fatura.csv', [{ occurred_on: '2026-12-20', description: 'x', amount_cents: 1 }])).toBe('2027-01')
  })
})

import { detectLocale, formatBytes } from '../src/lib/i18n'

describe('idioma do aparelho', () => {
  it('escolhe o primeiro idioma conhecido', () => {
    expect(detectLocale(['pt-BR', 'en-US'])).toBe('pt')
    expect(detectLocale(['en-GB'])).toBe('en')
    expect(detectLocale(['fr-FR', 'es-MX', 'en'])).toBe('es')
  })
  it('cai no português quando não conhece', () => {
    expect(detectLocale(['ja-JP'])).toBe('pt')
    expect(detectLocale(undefined)).toBe('pt')
    expect(detectLocale([])).toBe('pt')
  })
  it('formata tamanho de arquivo', () => {
    expect(formatBytes(512, 'pt')).toBe('512 B')
    expect(formatBytes(2048, 'en')).toBe('2 KB')
    expect(formatBytes(1_572_864, 'pt')).toBe('1,5 MB')
  })
})

import { cardStyle } from '../src/lib/cards'
import { BANK_COLOR, FALLBACK } from '../src/lib/palette'

describe('cor dos cartões', () => {
  const accs = [{ id: 'a', name: 'Cresol' }, { id: 'b', name: 'Santander Elite' }, { id: 'c', name: 'Nubank' }, { id: 'd', name: 'Inter' }, { id: 'e', name: 'C6' }]
  it('usa a cor da marca de cada banco, em qualquer ordem', () => {
    expect(cardStyle(accs, 'c').color).toBe(BANK_COLOR.nubank) // roxo
    expect(cardStyle(accs, 'a').color).toBe(BANK_COLOR.cresol) // laranja
    expect(cardStyle(accs, 'b').color).toBe(BANK_COLOR.santander) // vermelho
    expect(cardStyle([...accs].reverse(), 'c').color).toBe(BANK_COLOR.nubank)
  })
  it('outros bancos recebem cores fixas que não repetem as da marca', () => {
    expect(cardStyle(accs, 'd').color).toBe(FALLBACK[0])
    expect(cardStyle(accs, 'e').color).toBe(FALLBACK[1])
    expect(Object.values(BANK_COLOR)).not.toContain(cardStyle(accs, 'd').color)
  })
  it('compra sem cartão fica cinza', () => {
    expect(cardStyle(accs, null)).toEqual({ name: 'Sem cartão', color: '#71717a' })
  })
})

import { foldTop } from '../src/lib/ledger'

describe('foldTop (fatias da rosca)', () => {
  const s = (key: string, cents: number) => ({ key, cents, count: 1 })
  it('junta o excedente em "Demais" e ignora valores negativos', () => {
    const r = foldTop([s('a', 50), s('b', 40), s('c', 30), s('d', 20), s('e', 10), s('f', 5), s('g', 3), s('x', -9)], 5)
    expect(r.map((x) => x.key)).toEqual(['a', 'b', 'c', 'd', 'e', '__other__'])
    expect(r[5]).toMatchObject({ label: 'Demais', cents: 8, count: 2, folded: true })
  })
  it('sem excedente não cria "Demais"', () => {
    expect(foldTop([s('a', 2), s('b', 1)], 5).map((x) => x.key)).toEqual(['a', 'b'])
  })
})

import { colorWarnings, contrast, deltaE, SURFACE } from '../src/lib/color'
import { PRESET_COLORS } from '../src/lib/palette'

describe('cor escolhida pelo usuário', () => {
  it('a cor escolhida vence a da marca', () => {
    const accs = [{ id: 'n', name: 'Nubank', color: '#3987e5' }, { id: 'c', name: 'Cresol', color: null }]
    expect(cardStyle(accs, 'n').color).toBe('#3987e5')
    expect(cardStyle(accs, 'c').color).toBe(BANK_COLOR.cresol)
  })
  it('ignora cor inválida', () => {
    expect(cardStyle([{ id: 'n', name: 'Nubank', color: 'roxo' }], 'n').color).toBe(BANK_COLOR.nubank)
  })
  it('cartão com cor própria não consome cor de reserva', () => {
    const accs = [{ id: 'a', name: 'Inter', color: '#d55181' }, { id: 'b', name: 'C6', color: null }]
    expect(cardStyle(accs, 'b').color).toBe(FALLBACK[0])
  })
  it('mede contraste e diferença entre cores', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0)
    expect(deltaE(BANK_COLOR.cresol, BANK_COLOR.santander)).toBeGreaterThan(15) // as cores de marca escolhidas se distinguem
    expect(deltaE('#d95926', '#e66767')).toBeLessThan(15) // laranja/vermelho "puros" se confundiam
  })
  it('todas as opções do seletor têm contraste suficiente no fundo', () => {
    for (const p of PRESET_COLORS) expect(contrast(p.hex, SURFACE)).toBeGreaterThanOrEqual(3)
  })
  it('avisa cor escura demais e cor parecida com outro cartão', () => {
    expect(colorWarnings('#222222', [])).toHaveLength(1)
    expect(colorWarnings('#c90c27', [{ name: 'Santander', color: '#c70d28' }])[0]).toMatch(/Santander/)
    expect(colorWarnings('#3987e5', [{ name: 'Nubank', color: '#a05ae0' }])).toEqual([])
  })
})

import { categoryByMonth, categorySeries, compareMonths } from '../src/lib/trends'
import { goalStatus, suggestGoal } from '../src/lib/goals'
import { buildEvents, clampDay, daysInMonth, daysUntil, monthGrid } from '../src/lib/calendar'

describe('tendências por categoria', () => {
  const row = (id: string, m: string, c: number, desc = 'X') => ({ id, occurred_on: '2026-01-01', billed_month: `${m}-01`, description: desc, amount_cents: c, installment_no: null, installment_total: null, category_id: null, account_id: 'a' })
  it('agrupa por mês e categoria e compara com o mês anterior', () => {
    const by = categoryByMonth([row('1', '2026-09', 1000, 'A'), row('2', '2026-10', 1500, 'A'), row('3', '2026-10', 400, 'B'), row('4', '2026-09', 700, 'C')], (r) => r.description)
    const d = compareMonths(by.get('2026-10'), by.get('2026-09'))
    expect(d.map((x) => [x.name, x.delta])).toEqual([['C', -700], ['A', 500], ['B', 400]])
    expect(d.find((x) => x.name === 'A')!.pct).toBeCloseTo(0.5)
    expect(d.find((x) => x.name === 'B')!.pct).toBeNull() // categoria nova
  })
  it('série de uma categoria devolve 0 nos meses sem gasto', () => {
    const by = categoryByMonth([row('1', '2026-09', 1000, 'A'), row('2', '2026-11', 300, 'A')], (r) => r.description)
    expect(categorySeries(by, ['2026-09', '2026-10', '2026-11'], 'A')).toEqual([1000, 0, 300])
  })
})

describe('metas por categoria', () => {
  it('classifica dentro / perto / acima da meta', () => {
    expect(goalStatus(5000, 10000)).toMatchObject({ state: 'ok', left: 5000 })
    expect(goalStatus(8000, 10000)).toMatchObject({ state: 'near' })
    expect(goalStatus(10000, 10000)).toMatchObject({ state: 'near', left: 0 }) // exatamente na meta ainda não passou
    expect(goalStatus(12500, 10000)).toMatchObject({ state: 'over', left: -2500 })
  })
  it('sugere a média dos últimos 3 meses menos 10%', () => {
    expect(suggestGoal([100000, 200000, 150000, 150000])).toBe(150000) // média(200k,150k,150k)=166.667 → -10% = 150.000
    expect(suggestGoal([0, 0])).toBeNull()
  })
})

describe('calendário de vencimentos', () => {
  it('conta dias e limita o dia ao fim do mês', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(clampDay(31, 2026, 2)).toBe(28)
    expect(daysUntil(new Date(2026, 9, 30), 2026, 11, 7)).toBe(8)
    expect(daysUntil(new Date(2026, 9, 30), 2026, 10, 28)).toBe(-2)
  })
  it('monta a grade começando no domingo', () => {
    const g = monthGrid(2026, 11) // 1º de novembro/2026 é domingo
    expect(g[0][0]).toBe(1)
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g.flat().filter(Boolean)).toHaveLength(30)
  })
  it('lista faturas (reais e projetadas) e contas fixas por dia', () => {
    const r = (id: string, acc: string, c: number, n: number | null, tot: number | null) => ({ id, occurred_on: '2026-08-03', billed_month: '2026-10-01', description: id, amount_cents: c, installment_no: n, installment_total: tot, category_id: null, account_id: acc })
    const rows = [r('a', 'c1', 5000, null, null), r('b', 'c1', 2000, 1, 3), r('c', 'c2', 1000, 2, 2)]
    const input = { accounts: [{ id: 'c1', name: 'Cresol', due_day: 7 }, { id: 'c2', name: 'Nubank', due_day: 10 }, { id: 'c3', name: 'Sem dia', due_day: null }], rows,
      bills: [{ id: 'b1', name: 'Aluguel', expected_cents: 170000, due_day: 28 }], colorOf: () => '#fff', billColor: '#aaa' }
    const out = buildEvents({ ...input, ym: '2026-10' })
    expect(out.map((e) => [e.day, e.label, e.cents])).toEqual([[7, 'Cresol', 7000], [10, 'Nubank', 1000], [28, 'Aluguel', 170000]])
    expect(out.map((e) => [e.kind, e.ref])).toEqual([['card', 'c1'], ['card', 'c2'], ['bill', 'b1']])
    const nov = buildEvents({ ...input, ym: '2026-11' }) // mês futuro: só as parcelas já contratadas
    expect(nov.find((e) => e.label === 'Cresol')).toMatchObject({ cents: 2000, note: 'só as parcelas já contratadas' })
    expect(nov.find((e) => e.label === 'Nubank')).toMatchObject({ cents: null, note: 'ainda sem fatura' })
  })
})

import { attention, type DueEvent } from '../src/lib/calendar'

describe('vencimentos que pedem atenção', () => {
  const ev = (day: number, label: string, ref: string): DueEvent => ({ day, kind: 'card', ref, label, cents: 1000, color: '#fff', note: 'fatura' })
  const eventsOf = (ym: string) => (ym === '2026-11' ? [ev(2, 'Atrasada', 'a'), ev(3, 'Paga', 'b'), ev(7, 'Em breve', 'c'), ev(20, 'Longe', 'd')] : [ev(1, 'Mês seguinte', 'e')])
  const paid = (e: DueEvent) => e.ref === 'b'
  it('separa atrasados (não pagos) dos que vencem na janela, ignorando os pagos e os distantes', () => {
    const r = attention(new Date(2026, 10, 4), eventsOf, paid) // 04/11/2026
    expect(r.overdue.map((e) => [e.label, e.inDays])).toEqual([['Atrasada', -2]])
    expect(r.soon.map((e) => [e.label, e.inDays])).toEqual([['Em breve', 3]])
  })
  it('a janela atravessa a virada do mês', () => {
    const r = attention(new Date(2026, 10, 28), eventsOf, paid) // 28/11 → 01/12 está a 3 dias
    expect(r.soon.map((e) => e.label)).toEqual(['Mês seguinte'])
    expect(r.overdue.map((e) => e.label)).toEqual(['Atrasada', 'Em breve', 'Longe']) // em 28/11 tudo que não está pago e é de nov já passou
  })
})

import { dueLabel } from '../src/lib/calendar'

describe('frase de prazo', () => {
  it('descreve quanto falta (ou quanto passou)', () => {
    expect([0, 1, 5, -1, -4].map(dueLabel)).toEqual(['vence hoje', 'vence amanhã', 'vence em 5 dias', 'venceu ontem', 'venceu há 4 dias'])
  })
})

import { billAmount, billsForMonth, billsTotal } from '../src/lib/bills'

describe('conta variável (luz, água)', () => {
  const luz = { id: 'l', expected_cents: 66000, variable: true }
  const aluguel = { id: 'a', expected_cents: 170000, variable: false }
  const amounts = [{ bill_id: 'l', month: '2026-09-01', amount_cents: 71000 }, { bill_id: 'l', month: '2026-10-01', amount_cents: 58000 }]
  it('conta fixa sempre tem o valor cadastrado', () => {
    expect(billAmount(aluguel, '2026-11', amounts)).toEqual({ cents: 170000, estimated: false })
  })
  it('usa o valor real do mês quando já foi informado', () => {
    expect(billAmount(luz, '2026-10', amounts)).toEqual({ cents: 58000, estimated: false })
  })
  it('sem o do mês, estima pelo último valor informado antes dele', () => {
    expect(billAmount(luz, '2026-11', amounts)).toEqual({ cents: 58000, estimated: true })
    expect(billAmount(luz, '2026-09', amounts)).toEqual({ cents: 71000, estimated: false })
  })
  it('sem nenhum valor anterior, usa a estimativa cadastrada', () => {
    expect(billAmount(luz, '2026-08', amounts)).toEqual({ cents: 66000, estimated: true })
  })
  it('totaliza por mês e marca o que ainda é estimado', () => {
    expect(billsTotal([luz, aluguel], '2026-10', amounts)).toBe(228000)
    expect(billsTotal([luz, aluguel], '2026-11', amounts)).toBe(228000) // luz estimada pelo último mês (58.000)
    expect(billsForMonth([luz, aluguel], '2026-11', amounts).map((b) => [b.id, b.estimated])).toEqual([['l', true], ['a', false]])
  })
})

import { toInput } from '../src/lib/money'

describe('valor em campo de texto', () => {
  it('sempre com duas casas e vírgula', () => {
    expect([71240, 66000, 5, 100].map(toInput)).toEqual(['712,40', '660,00', '0,05', '1,00'])
  })
})

import { friendlyAuthError, friendlyError } from '../src/lib/errors'
import { validateAuth } from '../src/lib/authForm'

describe('mensagens de erro claras', () => {
  it('login e cadastro: traduz o erro do servidor e diz o que fazer', () => {
    expect(friendlyAuthError({ message: 'Invalid login credentials', error_code: 'invalid_credentials' })).toMatch(/E-mail ou senha incorretos/)
    expect(friendlyAuthError({ message: 'Email not confirmed', error_code: 'email_not_confirmed' })).toMatch(/confirmado/)
    expect(friendlyAuthError({ message: 'User already registered' })).toMatch(/Já existe uma conta/)
    expect(friendlyAuthError({ message: 'Password should be at least 6 characters.', error_code: 'weak_password' })).toMatch(/pelo menos 6 caracteres/)
    expect(friendlyAuthError({ message: 'email rate limit exceeded', error_code: 'over_email_send_rate_limit', status: 429 })).toMatch(/Muitas tentativas/)
    expect(friendlyAuthError({ message: 'Failed to fetch' })).toMatch(/Sem conexão/)
    expect(friendlyAuthError({ message: 'Signups not allowed for this instance' })).toMatch(/desativado/)
  })
  it('nenhuma mensagem mostra texto técnico em inglês', () => {
    for (const e of [{ message: 'boom' }, { message: 'JWT expired' }, { code: '23505', message: 'duplicate key value violates unique constraint' }, { code: '42501', message: 'new row violates row-level security policy' }]) {
      expect(friendlyAuthError(e)).not.toMatch(/violates|duplicate|JWT|boom|policy/i)
      expect(friendlyError(e, 'salvar a meta')).not.toMatch(/violates|duplicate|JWT|boom|policy/i)
    }
  })
  it('ações: dizem o que falhou e por quê', () => {
    expect(friendlyError({ code: '23505' }, 'criar o cartão')).toBe('Não foi possível criar o cartão. Esse item já existe.')
    expect(friendlyError({ message: 'Failed to fetch' }, 'salvar')).toMatch(/Sem conexão/)
    expect(friendlyError({ code: '42703', message: 'column does not exist' })).toMatch(/atualização/)
    expect(friendlyError({ message: 'JWT expired', code: 'PGRST303' })).toMatch(/sessão expirou/)
    expect(friendlyError(new Error('qualquer coisa'), 'excluir a fatura')).toMatch(/^Não foi possível excluir a fatura\. Ocorreu um erro inesperado/)
  })
})

describe('validação do cadastro', () => {
  const f = { email: 'a@b.com', password: 'senhaforte1', confirm: 'senhaforte1' }
  it('aceita dados corretos', () => {
    expect(validateAuth('up', f)).toEqual({})
    expect(validateAuth('in', { ...f, confirm: '' })).toEqual({})
  })
  it('aponta cada campo com problema', () => {
    expect(validateAuth('in', { email: '', password: '', confirm: '' })).toEqual({ email: 'Informe o seu e-mail.', password: 'Informe a sua senha.' })
    expect(validateAuth('in', { ...f, email: 'sem-arroba' }).email).toMatch(/não parece válido/)
    expect(validateAuth('up', { ...f, password: 'curta', confirm: 'curta' }).password).toMatch(/pelo menos 8/)
    expect(validateAuth('up', { ...f, confirm: 'outra-senha' }).confirm).toBe('As senhas não são iguais.')
    expect(validateAuth('up', { ...f, confirm: '' }).confirm).toMatch(/Digite a senha de novo/)
  })
  it('no login não exige o tamanho mínimo (contas antigas continuam entrando)', () => {
    expect(validateAuth('in', { email: 'a@b.com', password: '123', confirm: '' })).toEqual({})
  })
})

import { buildSteps, progress, type Facts } from '../src/lib/onboarding'

describe('guia de primeiros passos', () => {
  const none: Facts = { statements: false, cards: 0, cardsMissingDueDay: 0, categorized: false, income: false, bills: false, goal: false, payment: false }
  it('usuário novo: nada feito, o próximo passo é importar', () => {
    const p = progress(buildSteps(none))
    expect(p).toMatchObject({ done: 0, total: 7, essentialsDone: false, allDone: false })
    expect(p.next?.id).toBe('import')
  })
  it('os passos se marcam sozinhos pelos dados e o próximo avança', () => {
    const s = buildSteps({ ...none, statements: true, cards: 3, cardsMissingDueDay: 1 })
    expect(s.filter((x) => x.done).map((x) => x.id)).toEqual(['import'])
    expect(progress(s).next?.id).toBe('cards') // ainda falta o vencimento de um cartão
    expect(buildSteps({ ...none, statements: true, cards: 3, cardsMissingDueDay: 0 }).find((x) => x.id === 'cards')!.done).toBe(true)
  })
  it('sem cartões, o passo dos vencimentos manda importar antes', () => {
    const c = buildSteps(none).find((x) => x.id === 'cards')!
    expect(c.href).toBe('/import')
    expect(c.done).toBe(false)
  })
  it('os essenciais vêm antes dos opcionais', () => {
    const f: Facts = { statements: true, cards: 1, cardsMissingDueDay: 0, categorized: true, income: true, bills: true, goal: false, payment: false }
    const p = progress(buildSteps(f))
    expect(p.essentialsDone).toBe(true)
    expect(p.allDone).toBe(false)
    expect(p.next).toMatchObject({ id: 'goal', optional: true })
  })
  it('tudo feito', () => {
    expect(progress(buildSteps({ statements: true, cards: 1, cardsMissingDueDay: 0, categorized: true, income: true, bills: true, goal: true, payment: true }))).toMatchObject({ done: 7, allDone: true, next: undefined })
  })
})
