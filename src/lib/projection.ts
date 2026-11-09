export interface CardInput { id: string; name: string }
export interface CardProjection {
  id: string
  name: string
  /** Parcelas de compras antigas que já vão cair nesta fatura. */
  installments: number
  /** Total da fatura até agora, como o usuário informou (null = ainda não informou). */
  informed: number | null
  /** Compras novas além das parcelas conhecidas. */
  fresh: number
  /** O que já está comprometido neste cartão: o maior entre o informado e as parcelas. */
  total: number
}
export interface Projection {
  cards: CardProjection[]
  installments: number
  fresh: number
  cardsTotal: number
  fixed: number
  committed: number
  income: number
  free: number
  /** % da renda já comprometida (0 sem renda). */
  usedPct: number
}

/**
 * Projeção de um mês: faturas dos cartões (parcelas conhecidas + total informado) + contas do mês, contra a renda.
 * O total informado já inclui as parcelas; por isso "compras novas" = informado − parcelas (nunca negativo) e,
 * se o informado for menor que as parcelas, vale o das parcelas (o total não pode ser menor que o já parcelado).
 */
export function projectMonth(o: {
  cards: CardInput[]
  installmentsByCard: Record<string, number>
  informedByCard: Record<string, number>
  fixed: number
  income: number
}): Projection {
  const cards = o.cards.map((c): CardProjection => {
    const installments = o.installmentsByCard[c.id] ?? 0
    const informed = c.id in o.informedByCard ? o.informedByCard[c.id] : null
    const fresh = informed != null ? Math.max(informed - installments, 0) : 0
    return { id: c.id, name: c.name, installments, informed, fresh, total: informed != null ? Math.max(informed, installments) : installments }
  })
  const installments = cards.reduce((s, c) => s + c.installments, 0)
  const cardsTotal = cards.reduce((s, c) => s + c.total, 0)
  const committed = cardsTotal + o.fixed
  return {
    cards, installments, fresh: cards.reduce((s, c) => s + c.fresh, 0), cardsTotal, fixed: o.fixed, committed,
    income: o.income, free: o.income - committed, usedPct: o.income > 0 ? Math.round((committed / o.income) * 100) : 0,
  }
}
