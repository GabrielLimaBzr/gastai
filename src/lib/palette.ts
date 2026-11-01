/** Cores categóricas em ordem fixa (passo "dark" da paleta validada: CVD e contraste OK sobre fundo escuro). */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
export const RANK_BAR = '#3987e5'
/** Cinza neutro das contas fixas: não é um cartão, então não usa uma cor da série. */
export const FIXED_COLOR = '#a1a1aa'

/**
 * Cor de marca de cada banco. Laranja e vermelho são vizinhos, então os tons foram escolhidos
 * (vermelho mais escuro, laranja mais vivo) para passar no validador de paleta em todos os pares:
 * diferença de cor ≥ 19 (visão normal) e ≥ 13 (daltonismo), contra mínimos de 15 e 8.
 */
export const BANK_COLOR = { nubank: '#a05ae0', cresol: '#d57c11', santander: '#c90c27' } as const

/** Cartões de outros bancos: tons que não se parecem com os três acima (sem amarelo/laranja/vermelho/violeta). */
export const FALLBACK = ['#3987e5', '#199e70', '#d55181', '#008300']

/** Fatias da rosca de categorias, nesta ordem: todas as vizinhas (inclusive a que fecha o anel) passam no validador. */
export const RING = ['#3987e5', '#199e70', '#c98500', '#d55181', '#008300']
export const RING_OTHER = '#71717a'

/** Opções do seletor de cor do cartão: todas com contraste ≥ 3:1 no fundo escuro. */
export const PRESET_COLORS: { hex: string; name: string }[] = [
  { hex: '#a05ae0', name: 'Roxo' }, { hex: '#d57c11', name: 'Laranja' }, { hex: '#c90c27', name: 'Vermelho' },
  { hex: '#3987e5', name: 'Azul' }, { hex: '#199e70', name: 'Verde-água' }, { hex: '#d55181', name: 'Rosa' },
  { hex: '#c98500', name: 'Amarelo' }, { hex: '#008300', name: 'Verde' }, { hex: '#9085e9', name: 'Violeta' },
  { hex: '#a1a1aa', name: 'Cinza' },
]
