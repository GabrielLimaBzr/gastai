import { SERIES } from '@/components/charts'

/** Nome e cor de um cartão. A cor segue a ordem de criação e é a mesma em todas as telas. */
export function cardStyle(accounts: { id: string; name: string }[], id: string | null): { name: string; color: string } {
  const i = accounts.findIndex((a) => a.id === id)
  return i < 0 ? { name: 'Sem cartão', color: '#71717a' } : { name: accounts[i].name, color: SERIES[i % SERIES.length] }
}
