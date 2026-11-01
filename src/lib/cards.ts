import { bankOfAccount } from './bank'
import { isHex } from './color'
import { BANK_COLOR, FALLBACK } from './palette'

export interface CardAccount { id: string; name: string; color?: string | null }

/**
 * Nome e cor de um cartão. Ordem de prioridade: cor escolhida pelo usuário, cor da marca do banco
 * (Nubank roxo, Cresol laranja, Santander vermelho) e, para os demais, uma cor fixa pela ordem de criação.
 * Igual em todas as telas.
 */
export function cardStyle(accounts: CardAccount[], id: string | null): { name: string; color: string } {
  const acc = accounts.find((a) => a.id === id)
  if (!acc) return { name: 'Sem cartão', color: '#71717a' }
  if (isHex(acc.color)) return { name: acc.name, color: acc.color }
  const bank = bankOfAccount(acc.name)
  if (bank) return { name: acc.name, color: BANK_COLOR[bank] }
  const others = accounts.filter((a) => !isHex(a.color) && !bankOfAccount(a.name))
  return { name: acc.name, color: FALLBACK[others.findIndex((a) => a.id === acc.id) % FALLBACK.length] }
}
