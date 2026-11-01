/** Cor de fundo dos cartões/gráficos (zinc-900); referência para contraste. */
export const SURFACE = '#18181b'

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)

/** Contraste WCAG entre duas cores (1 a 21). Marcas de gráfico pedem pelo menos 3. */
export function contrast(a: string, b: string): number {
  const L = (h: string) => { const [r, g, bl] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * bl }
  const [hi, lo] = [L(a), L(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function oklab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}

/** Diferença perceptiva entre duas cores (OKLab ×100). Abaixo de ~15 elas se confundem. */
export function deltaE(a: string, b: string): number {
  const [x, y] = [oklab(a), oklab(b)]
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}

export const SIMILAR_BELOW = 15

/** Avisos para uma cor escolhida: pouco contraste com o fundo ou parecida com a de outro cartão. */
export function colorWarnings(hex: string, others: { name: string; color: string }[]): string[] {
  const out: string[] = []
  if (contrast(hex, SURFACE) < 3) out.push('Essa cor é muito escura para o fundo: pode ficar difícil de ver nos gráficos.')
  const near = others.find((o) => deltaE(hex, o.color) < SIMILAR_BELOW)
  if (near) out.push(`Parecida com a cor de «${near.name}»: nos gráficos as duas podem se confundir.`)
  return out
}
