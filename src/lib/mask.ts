/** Máscara de dinheiro: só os dígitos contam e entram da direita para a esquerda ("1234" → "12,34"). */
export function maskMoney(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12)
  if (!digits) return ''
  const padded = digits.padStart(3, '0')
  const int = padded.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${int},${padded.slice(-2)}`
}

/** Valor (em centavos) já formatado para o campo: 123456 → "1.234,56". */
export const moneyField = (cents: number): string => maskMoney(String(Math.max(0, Math.round(cents))))

/** Máscara de dia do mês: até 2 dígitos, entre 1 e 31. */
export function maskDay(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 2)
  if (!d) return ''
  return String(Math.min(31, Math.max(+d, d.length === 2 ? 1 : 0)) || '')
}
