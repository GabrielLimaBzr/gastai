/**
 * Paletas de dados por tema. Cada conjunto foi validado (validate_palette) contra o fundo do seu tema:
 * faixa de luminosidade, croma, separação para daltonismo (≥ 8) e visão normal (≥ 15) e contraste (≥ 3:1).
 * A cor segue a entidade (cartão, categoria), nunca o ranking.
 */
export type Mode = 'dark' | 'light'

export interface PaletteSet {
  /** Cor de fundo das folhas/gráficos (para calcular contraste). */
  surface: string
  rankBar: string
  /** Cinza neutro das contas fixas: não é um cartão, então não usa cor de série. */
  fixed: string
  none: string
  /** Cor de marca de cada banco (laranja e vermelho foram afastados para não se confundirem). */
  bank: { nubank: string; cresol: string; santander: string }
  /** Cartões de outros bancos: tons que não se parecem com os de marca. */
  fallback: string[]
  /** Fatias da rosca, nesta ordem: todas as vizinhas (inclusive a que fecha o anel) passam no validador. */
  ring: string[]
  ringOther: string
  /** Comparação mês a mês e metas. */
  up: string
  down: string
  goal: { ok: string; near: string; over: string }
  /** Opções do seletor de cor do cartão (todas com contraste ≥ 3:1 no fundo). */
  presets: { hex: string; name: string }[]
}

const SETS: Record<Mode, PaletteSet> = {
  dark: {
    surface: '#141b23',
    rankBar: '#3987e5',
    fixed: '#9aa8b8',
    none: '#6b7787',
    bank: { nubank: '#a05ae0', cresol: '#cb7e19', santander: '#cc1331' },
    fallback: ['#3987e5', '#199e70', '#da709d'],
    ring: ['#3987e5', '#199e70', '#c98500', '#d55181', '#008300'],
    ringOther: '#6b7787',
    up: '#c98500',
    down: '#199e70',
    goal: { ok: '#199e70', near: '#c98500', over: '#cc1331' },
    presets: [
      { hex: '#a05ae0', name: 'Roxo' }, { hex: '#cb7e19', name: 'Laranja' }, { hex: '#cc1331', name: 'Vermelho' },
      { hex: '#3987e5', name: 'Azul' }, { hex: '#199e70', name: 'Verde-água' }, { hex: '#d55181', name: 'Rosa' },
      { hex: '#c98500', name: 'Amarelo' }, { hex: '#008300', name: 'Verde' }, { hex: '#9085e9', name: 'Violeta' },
      { hex: '#9aa8b8', name: 'Cinza' },
    ],
  },
  light: {
    surface: '#ffffff',
    rankBar: '#2a78d6',
    fixed: '#7a8797',
    none: '#8793a2',
    bank: { nubank: '#7f36bc', cresol: '#df7b0c', santander: '#b7162d' },
    fallback: ['#3987e5', '#199e70', '#b572a7'],
    ring: ['#2a78d6', '#0f9b6c', '#6250d6', '#d4457f', '#b27500'],
    ringOther: '#8793a2',
    up: '#b45309',
    down: '#0f9b6c',
    goal: { ok: '#0f9b6c', near: '#b45309', over: '#b7162d' },
    presets: [
      { hex: '#7f36bc', name: 'Roxo' }, { hex: '#df7b0c', name: 'Laranja' }, { hex: '#b7162d', name: 'Vermelho' },
      { hex: '#2a78d6', name: 'Azul' }, { hex: '#0f9b6c', name: 'Verde-água' }, { hex: '#d4457f', name: 'Rosa' },
      { hex: '#b27500', name: 'Amarelo' }, { hex: '#2f7d1a', name: 'Verde' }, { hex: '#6250d6', name: 'Violeta' },
      { hex: '#7a8797', name: 'Cinza' },
    ],
  },
}

let current: Mode = 'dark'

/** Chamado pelo ThemeProvider antes de renderizar os filhos; a árvore é remontada ao trocar de tema. */
export const setPaletteMode = (m: Mode) => { current = m }
export const getPaletteMode = (): Mode => current
export const palette = (): PaletteSet => SETS[current]
export const paletteFor = (m: Mode): PaletteSet => SETS[m]
