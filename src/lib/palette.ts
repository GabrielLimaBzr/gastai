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
