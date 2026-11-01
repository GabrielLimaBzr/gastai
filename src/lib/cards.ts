import { bankOfAccount } from './bank'
import { BANK_COLOR, FALLBACK } from './palette'

/**
 * Nome e cor de um cartão. Bancos conhecidos têm a cor da marca (Nubank roxo, Cresol laranja,
 * Santander vermelho); os demais recebem uma cor fixa pela ordem de criação. Igual em todas as telas.
 */
export function cardStyle(accounts: { id: string; name: string }[], id: string | null): { name: string; color: string } {
  const acc = accounts.find((a) => a.id === id)
  if (!acc) return { name: 'Sem cartão', color: '#71717a' }
  const bank = bankOfAccount(acc.name)
  if (bank) return { name: acc.name, color: BANK_COLOR[bank] }
  const others = accounts.filter((a) => !bankOfAccount(a.name))
  return { name: acc.name, color: FALLBACK[others.findIndex((a) => a.id === acc.id) % FALLBACK.length] }
}
