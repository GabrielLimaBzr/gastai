export interface BillBase { id: string; expected_cents: number; variable?: boolean }
export interface BillAmount { bill_id: string; month: string; amount_cents: number }
export interface BillValue { cents: number; estimated: boolean }

/**
 * Valor de uma conta em um mês. Conta fixa: sempre o valor cadastrado. Conta variável (luz, água…): o valor
 * informado para aquele mês; se ainda não chegou, o último valor informado antes dele; se nunca houve,
 * a estimativa cadastrada. `estimated` diz que o número ainda não é o real.
 */
export function billAmount(bill: BillBase, ym: string, amounts: BillAmount[]): BillValue {
  if (!bill.variable) return { cents: bill.expected_cents, estimated: false }
  const mine = amounts.filter((a) => a.bill_id === bill.id)
  const exact = mine.find((a) => a.month.slice(0, 7) === ym)
  if (exact) return { cents: exact.amount_cents, estimated: false }
  const earlier = mine.filter((a) => a.month.slice(0, 7) < ym).sort((a, b) => b.month.localeCompare(a.month))[0]
  return { cents: earlier ? earlier.amount_cents : bill.expected_cents, estimated: true }
}

/** As contas já com o valor daquele mês no lugar de `expected_cents` (e o aviso de estimativa). */
export function billsForMonth<T extends BillBase>(bills: T[], ym: string, amounts: BillAmount[]): (T & { estimated: boolean })[] {
  return bills.map((b) => { const v = billAmount(b, ym, amounts); return { ...b, expected_cents: v.cents, estimated: v.estimated } })
}

export const billsTotal = (bills: BillBase[], ym: string, amounts: BillAmount[]): number =>
  bills.reduce((s, b) => s + billAmount(b, ym, amounts).cents, 0)
