/** O que já existe nos dados do usuário: é daqui que o guia sabe quais passos já foram feitos. */
export interface Facts {
  statements: boolean // importou alguma fatura
  cards: number
  cardsMissingDueDay: number
  categorized: boolean // confirmou a categoria de pelo menos uma compra
  income: boolean
  bills: boolean
  goal: boolean
  payment: boolean
}

export interface Step {
  id: 'import' | 'cards' | 'categories' | 'income' | 'bills' | 'goal' | 'payment'
  title: string
  why: string
  href: string
  cta: string
  done: boolean
  optional: boolean
}

export function buildSteps(f: Facts): Step[] {
  return [
    { id: 'import', title: 'Importe a sua primeira fatura', why: 'PDF do Santander, Cresol ou Banco do Brasil, ou o CSV do Nubank. O app reconhece o banco, escolhe o cartão e confere o total.', href: '/import', cta: 'Importar fatura', done: f.statements, optional: false },
    { id: 'cards', title: 'Confirme o vencimento dos cartões', why: 'Com o dia em que cada fatura vence, o Calendário mostra o que está perto de vencer.', href: f.cards ? '/calendar' : '/import', cta: f.cards ? 'Informar vencimentos' : 'Importar primeiro', done: f.cards > 0 && f.cardsMissingDueDay === 0, optional: false },
    { id: 'categories', title: 'Categorize as compras', why: 'Diga em que cada compra se encaixa. Escolher uma vez vale para todas do mesmo lugar e para as próximas faturas.', href: '/transactions?filtro=sem-categoria', cta: 'Categorizar', done: f.categorized, optional: false },
    { id: 'income', title: 'Informe a sua renda do mês', why: 'Mostra quanto do salário já está comprometido e quanto sobra.', href: '/?renda=1', cta: 'Informar renda', done: f.income, optional: false },
    { id: 'bills', title: 'Cadastre as contas fixas e variáveis', why: 'Aluguel, internet, luz… entram no total do mês e no Calendário.', href: '/bills', cta: 'Cadastrar contas', done: f.bills, optional: false },
    { id: 'goal', title: 'Crie uma meta de gasto', why: 'Um limite para delivery, por exemplo: o app avisa quando você passar.', href: '/goals', cta: 'Criar meta', done: f.goal, optional: true },
    { id: 'payment', title: 'Marque um pagamento no Calendário', why: 'Toque no círculo ao pagar uma fatura e acompanhe o "A pagar" diminuir.', href: '/calendar', cta: 'Abrir Calendário', done: f.payment, optional: true },
  ]
}

export interface Progress { done: number; total: number; next: Step | undefined; essentialsDone: boolean; allDone: boolean }

/** `next` = primeiro passo pendente, os essenciais antes dos opcionais. */
export function progress(steps: Step[]): Progress {
  const pending = steps.filter((s) => !s.done)
  const next = pending.find((s) => !s.optional) ?? pending[0]
  return {
    done: steps.length - pending.length, total: steps.length, next,
    essentialsDone: steps.filter((s) => !s.optional).every((s) => s.done), allDone: pending.length === 0,
  }
}
