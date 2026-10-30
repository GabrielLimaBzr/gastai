export type Flex = 'essential' | 'flexible'

export interface CategoryDef { name: string; flex: Flex; match: RegExp }

/** Ordem importa: a primeira regra que casar vence. Regras por palavra-chave do estabelecimento. */
export const CATEGORIES: CategoryDef[] = [
  { name: 'Encargos e tarifas', flex: 'flexible', match: /\b(IOF|ANUIDADE|ENCARGO|JUROS|MULTA)\b/ },
  { name: 'Delivery e restaurantes', flex: 'flexible', match: /IFD\*|IFOOD|ZE DELIVERY|DELIVERY|BURGER|SUBWAY|CHEIRIN|LANCHES|MINEIRA|CABANA|SAMUKA|EMPORIO|CHURR|DEKOS|ACAITERIA|PIZZ|BAR E GRIL|BARRACA/ },
  { name: 'Transporte por app', flex: 'flexible', match: /UBER|^99\*|\b99\b|CABIFY/ },
  { name: 'Assinaturas e digital', flex: 'flexible', match: /ANTHROPIC|CLAUDE|BONOX|MELIMAIS|NETFLIX|SPOTIFY|YOUTUBE|DISNEY|PRIME|GOOGLE|APPLE\.COM/ },
  { name: 'Academia', flex: 'flexible', match: /WELLHUB|GYMPASS|SELFIT|ZAPYFIT|SMART FIT/ },
  { name: 'Compras', flex: 'flexible', match: /MERCADOLIVRE|MERCADO LIVRE|CASAS BAHIA|IMAGINARIUM|AMAZON|SHOPEE|MAGALU/ },
  { name: 'Pet', flex: 'flexible', match: /PETZ|COBASI|PETLOVE/ },
  { name: 'Supermercado', flex: 'essential', match: /MATEUS|SUPERMERCADO|ARMAZEM|ATACAD|ASSAI|CARREFOUR/ },
  { name: 'Saúde', flex: 'essential', match: /HOSPITAL|PAGUE MENOS|DROGA|FARMA|NEODENT|ODONTO|CLINICA|LABORAT/ },
  { name: 'Combustível', flex: 'essential', match: /\bPOSTO\b|SHELL|IPIRANGA|PETROBRAS/ },
  { name: 'Casa e contas', flex: 'essential', match: /INTERNET|ALUGUEL|ENERGIA|CEMAR|ENEL|AGUA|CONDOM|\bTIM\b|VIVO|CLARO/ },
]

export const OTHER = 'Outros'

export function categoryOf(description: string): CategoryDef | null {
  const d = description.toUpperCase()
  return CATEGORIES.find((c) => c.match.test(d)) ?? null
}

export const DEFAULT_NAMES = [...CATEGORIES.map((c) => c.name), OTHER]

/** Categorias criadas pelo usuário contam como cortáveis até que se diga o contrário. */
export const flexOf = (name: string): Flex => CATEGORIES.find((c) => c.name === name)?.flex ?? 'flexible'

/** Categoria efetiva: a escolhida pelo usuário vence a automática por palavra-chave. */
export const effectiveCategory = (description: string, chosen?: string | null): string =>
  chosen ?? categoryOf(description)?.name ?? OTHER
