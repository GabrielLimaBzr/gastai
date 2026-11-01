'use client'
import { useMemo } from 'react'
import { useTransactions } from '@/hooks/useData'
import { detectAnomalies } from '@/lib/anomalies'
import { PageSkeleton } from '@/components/ui'

const LABEL = { duplicate: 'Duplicada', spike: 'Pico', new_merchant_high: 'Novo e alto', price_change: 'Preço mudou' }

export default function Anomalies() {
  const { rows, loading } = useTransactions()
  const found = useMemo(() => detectAnomalies(rows), [rows])
  if (loading) return <PageSkeleton />
  if (!found.length) return <p className="text-zinc-400">Nenhuma anomalia detectada.</p>
  return (
    <ul className="space-y-2">
      {found.map((a, i) => (
        <li key={i} className="card text-sm">
          <span className="mr-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">{LABEL[a.kind]}</span>
          {a.message} <span className="text-zinc-500">({a.tx.occurred_on})</span>
        </li>
      ))}
    </ul>
  )
}
