export interface Tx {
  id?: string
  occurred_on: string // YYYY-MM-DD
  description: string
  amount_cents: number
  category_id?: string | null
  account_id?: string | null
  installment_no?: number | null
  installment_total?: number | null
  /** Mês da fatura (YYYY-MM-01): parcelas antigas contam no mês em que são cobradas. */
  billed_month?: string | null
}

export type AnomalyKind = 'duplicate' | 'spike' | 'new_merchant_high' | 'price_change'

export interface Anomaly {
  kind: AnomalyKind
  message: string
  tx: Tx
}
