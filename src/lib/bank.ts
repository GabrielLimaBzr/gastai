import type { Tx } from './types'

export const BANK_LABEL = { santander: 'Santander', cresol: 'Cresol', nubank: 'Nubank', bb: 'Banco do Brasil' } as const
export type KnownBank = keyof typeof BANK_LABEL

export const isKnownBank = (bank?: string): bank is KnownBank => !!bank && bank in BANK_LABEL

/** Como o cartão pode se chamar: "BB" só vale como palavra inteira para não casar com outros nomes. */
const NAME_OF: Record<KnownBank, RegExp> = {
  santander: /santander/,
  cresol: /cresol/,
  nubank: /nubank/,
  bb: /banco\s*do\s*brasil|ourocard|\bbb\b/,
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** O nome do cartão cadastrado cita o banco da fatura? ("Santander Elite", "Cartão Cresol"…) */
export const accountMatchesBank = (accountName: string, bank?: string): boolean =>
  isKnownBank(bank) && NAME_OF[bank].test(norm(accountName))

/** Banco de um cartão pelo nome ("Cartão Nubank Roxinho" → nubank), se for um dos conhecidos. */
export const bankOfAccount = (accountName: string): KnownBank | undefined =>
  (Object.keys(BANK_LABEL) as KnownBank[]).find((b) => accountMatchesBank(accountName, b))

export const matchAccount = <T extends { name: string }>(accounts: T[], bank?: string): T | undefined =>
  accounts.find((a) => accountMatchesBank(a.name, bank))

/**
 * Mês em que a fatura do Nubank vence. O CSV é exportado como `Nubank_AAAA-MM-DD.csv` (data da fatura);
 * sem isso, usa o mês seguinte à compra mais recente.
 */
export function nubankBilledMonth(fileName: string, txs: Tx[]): string | undefined {
  const f = fileName.match(/(\d{4})-(\d{2})-\d{2}/)
  if (f) return `${f[1]}-${f[2]}`
  const latest = txs.map((t) => t.occurred_on).sort().at(-1)
  if (!latest) return undefined
  const [y, m] = latest.slice(0, 7).split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
