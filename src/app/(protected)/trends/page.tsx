'use client'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useTransactions } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { StackedColumns, monthLabel } from '@/components/charts'
import { categorize, monthsDesc } from '@/lib/ledger'
import { categoryByMonth, categorySeries, compareMonths } from '@/lib/trends'
import { palette } from '@/lib/palette'
import { brl } from '@/lib/money'
import { useSharedMonth } from '@/contexts/month'
import { PageSkeleton } from '@/components/ui'
import { MonthSwitcher, PageHeader } from '@/components/ui'

// ↑ gasto subiu / ↓ gasto caiu: par quente/frio da paleta; o sentido também vai escrito (seta + sinal), nunca só a cor

const pct = (p: number | null) => (p == null ? 'novo' : `${p >= 0 ? '+' : '−'}${Math.abs(p * 100).toFixed(0)}%`)

export default function Trends() {
  const { rows, loading } = useTransactions()
  const { cats, ready } = useCategories()
  const [cat, setCat] = useState('')

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])
  const byMonth = useMemo(
    () => categoryByMonth(rows, (r) => categorize(r.description, r.category_id ? catName.get(r.category_id) : null).name),
    [rows, catName],
  )
  const months = useMemo(() => monthsDesc(rows), [rows])
  const [month, setMonth] = useSharedMonth(months, months[0] ?? '')

  // categorias ordenadas pelo total gasto em todo o histórico
  const names = useMemo(() => {
    const t = new Map<string, number>()
    for (const m of byMonth.values()) for (const [n, c] of m) t.set(n, (t.get(n) ?? 0) + Math.max(c, 0))
    return [...t.entries()].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([n]) => n)
  }, [byMonth])
  useEffect(() => { if (!cat && names.length) setCat(names[0]) }, [names, cat])

  if (loading || !ready) return <PageSkeleton />
  if (!months.length) return <p className="text-zinc-400">Importe faturas para ver as tendências.</p>

  const prev = months[months.indexOf(month) + 1]
  const deltas = compareMonths(byMonth.get(month), prev ? byMonth.get(prev) : undefined)
  const curTotal = deltas.reduce((s, d) => s + d.cur, 0)
  const prevTotal = deltas.reduce((s, d) => s + d.prev, 0)
  const maxAbs = Math.max(...deltas.map((d) => Math.abs(d.delta)), 1)
  const totalDelta = curTotal - prevTotal

  const asc = [...months].reverse().slice(-12)
  const series = categorySeries(byMonth, asc, cat)
  const goal = cats.find((c) => c.name === cat)?.goal_cents ?? null
  const withData = series.filter((v) => v > 0)
  const avg = withData.length ? withData.reduce((a, b) => a + b, 0) / withData.length : 0
  const peakIdx = series.indexOf(Math.max(...series))
  const last = series.at(-1) ?? 0

  return (
    <div className="space-y-4">
      <PageHeader title="Tendências" description="Como cada categoria se comporta de um mês para o outro." actions={<MonthSwitcher value={month} onChange={setMonth} options={months} />} />

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Contra o mês anterior</h2>
        </div>
        {!prev ? (
          <p className="mt-3 text-sm text-zinc-500">Só há uma fatura importada: assim que houver o mês seguinte, a comparação aparece aqui.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-zinc-400">
              {monthLabel(month)}: <b className="text-zinc-100">{brl(curTotal)}</b> contra {brl(prevTotal)} em {monthLabel(prev)} ·{' '}
              <b className={totalDelta > 0 ? 'text-amber-400' : 'text-emerald-400'}>{totalDelta > 0 ? '▲ +' : '▼ −'}{brl(Math.abs(totalDelta))} ({pct(prevTotal ? totalDelta / prevTotal : null)})</b>
            </p>
            <p className="mb-3 mt-1 flex flex-wrap gap-x-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: palette().up }} />gastou mais</span>
              <span className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: palette().down }} />gastou menos</span>
            </p>
            <ul className="space-y-3">
              {deltas.slice(0, 12).map((d) => (
                <li key={d.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate" title={d.name}>{d.name}</span>
                    <span className={`inline-flex shrink-0 items-center gap-1 tabular-nums ${d.delta > 0 ? 'text-amber-400' : d.delta < 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {d.delta > 0 ? <ArrowUp size={14} aria-hidden /> : d.delta < 0 ? <ArrowDown size={14} aria-hidden /> : null}
                      {d.delta > 0 ? '+' : d.delta < 0 ? '−' : ''}{brl(Math.abs(d.delta))} <span className="text-xs">({d.cur === 0 ? 'sumiu' : pct(d.pct)})</span>
                    </span>
                  </div>
                  {/* barra divergente: centro = sem mudança; direita = gastou mais, esquerda = gastou menos */}
                  <div className="relative mt-1 h-2 rounded-full bg-zinc-800" aria-hidden>
                    <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-600" />
                    <span className="absolute inset-y-0 rounded-full"
                      style={d.delta >= 0
                        ? { left: '50%', width: `${(d.delta / maxAbs) * 50}%`, background: palette().up }
                        : { right: '50%', width: `${(-d.delta / maxAbs) * 50}%`, background: palette().down }} />
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">de {brl(d.prev)} para {brl(d.cur)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Evolução de uma categoria</h2>
          <select className="input w-auto max-w-full" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
            {names.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
        <p className="mb-3 mt-1 text-xs text-zinc-500">Últimos {asc.length} meses de fatura{goal ? '; a linha branca é a sua meta mensal' : ''}.</p>
        <StackedColumns months={asc} series={[{ key: 'c', name: cat, color: palette().ring[0] }]}
          data={Object.fromEntries(asc.map((m, i) => [m, { c: series[i] }]))}
          marker={goal ? Object.fromEntries(asc.map((m) => [m, goal])) : undefined} markerLabel="Meta" height={200} />
        {withData.length > 0 && (
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-zinc-500">Média</dt><dd className="tabular-nums">{brl(Math.round(avg))}</dd></div>
            <div><dt className="text-xs text-zinc-500">Maior mês</dt><dd className="tabular-nums">{brl(series[peakIdx])} <span className="text-xs text-zinc-500">{monthLabel(asc[peakIdx])}</span></dd></div>
            <div><dt className="text-xs text-zinc-500">Último vs média</dt>
              <dd className={`tabular-nums ${last > avg ? 'text-amber-400' : 'text-emerald-400'}`}>{avg ? `${last > avg ? '▲ +' : '▼ −'}${Math.abs(((last - avg) / avg) * 100).toFixed(0)}%` : '—'}</dd></div>
          </dl>
        )}
      </section>
    </div>
  )
}
