'use client'
import { useEffect, useRef, useState } from 'react'
import { brl } from '@/lib/money'

/** Cores categóricas em ordem fixa (passo "dark" da paleta validada: CVD e contraste OK sobre fundo escuro). */
export const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
export const RANK_BAR = '#3987e5'
const AXIS = '#71717a'
const GRID = '#27272a'
const SURFACE = '#18181b'

export const fmtShort = (cents: number): string => {
  const v = Math.abs(cents) / 100
  if (v >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1).replace('.', ',')} mil`
  return String(Math.round(v))
}
export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-')
  return `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][+m - 1]}/${y.slice(2)}`
}
const niceMax = (v: number): number => {
  if (v <= 0) return 100_00
  const p = 10 ** Math.floor(Math.log10(v))
  return [1, 2, 4, 6, 8, 10].map((k) => k * p).find((c) => c >= v) ?? 10 * p
}

export interface Series { key: string; name: string; color: string }

/**
 * Colunas empilhadas por mês (uma cor por série, 2px de respiro entre fatias).
 * Uma única série dispensa legenda. `marker` desenha uma linha de referência por mês (ex.: renda).
 */
export function StackedColumns({ months, series, data, marker, markerLabel, height = 220 }: {
  months: string[]
  series: Series[]
  data: Record<string, Record<string, number>>
  marker?: Record<string, number>
  markerLabel?: string
  height?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; month: string } | null>(null)

  // mede a largura real: o SVG não encolhe e o texto continua com tamanho legível no celular
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = width, H = height, ml = 40, mr = 8, mt = 18, mb = 26
  const totals = months.map((m) => series.reduce((s, x) => s + Math.max(0, data[m]?.[x.key] ?? 0), 0))
  const top = niceMax(Math.max(...totals, ...months.map((m) => marker?.[m] ?? 0), 1))
  const y = (v: number) => mt + (H - mt - mb) * (1 - v / top)
  const band = (W - ml - mr) / Math.max(months.length, 1)
  const bw = Math.min(56, band * 0.62)
  const labelEvery = band < 46 ? 2 : 1
  const ticks = [0, top / 2, top]

  function show(e: React.PointerEvent, month: string) {
    const r = box.current!.getBoundingClientRect()
    setTip({ x: Math.min(e.clientX - r.left, r.width - 170), y: Math.max(e.clientY - r.top - 8, 0), month })
  }

  return (
    <div>
      {(series.length > 1 || marker) && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
          {series.length > 1 && series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />{s.name}</li>
          ))}
          {marker && <li className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 bg-zinc-100" />{markerLabel ?? 'Referência'}</li>}
        </ul>
      )}
      <div ref={box} className="relative">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Gráfico de colunas por mês">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={ml - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS}>{fmtShort(t)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = ml + band * i + band / 2
            let cum = 0
            return (
              <g key={m} onPointerEnter={(e) => show(e, m)} onPointerMove={(e) => show(e, m)} onPointerLeave={() => setTip(null)}>
                <rect x={cx - band / 2} y={mt} width={band} height={H - mt - mb} fill="transparent" />
                {series.map((s) => {
                  const v = Math.max(0, data[m]?.[s.key] ?? 0)
                  if (!v) return null
                  const y1 = y(cum + v), y0 = y(cum)
                  cum += v
                  return <rect key={s.key} x={cx - bw / 2} y={y1} width={bw} height={Math.max(y0 - y1, 1)} rx={3} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                })}
                {totals[i] > 0 && band >= 46 && (() => {
                  // se a linha de referência (renda) passa colada acima da coluna, o total sobe para não ser riscado por ela
                  const my = marker?.[m] ? y(marker[m]) : null
                  const ly = my != null && my < y(totals[i]) && y(totals[i]) - my < 22 ? my - 6 : y(totals[i]) - 5
                  return <text x={cx} y={ly} textAnchor="middle" fontSize={11} fill="#d4d4d8">{fmtShort(totals[i])}</text>
                })()}
                {marker?.[m] ? <line x1={cx - bw / 2 - 6} x2={cx + bw / 2 + 6} y1={y(marker[m])} y2={y(marker[m])} stroke="#fafafa" strokeWidth={2} /> : null}
                {i % labelEvery === 0 && <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill={AXIS}>{monthLabel(m)}</text>}
              </g>
            )
          })}
        </svg>
        {tip && (
          <div className="pointer-events-none absolute z-10 w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-xs shadow-lg" style={{ left: tip.x, top: tip.y, transform: 'translateY(-100%)' }}>
            <p className="mb-1 font-medium text-zinc-100">{monthLabel(tip.month)}</p>
            {series.map((s) => (data[tip.month]?.[s.key] ?? 0) !== 0 && (
              <p key={s.key} className="flex justify-between gap-2 text-zinc-300">
                <span className="flex items-center gap-1.5 truncate"><i className="inline-block size-2 shrink-0 rounded-sm" style={{ background: s.color }} />{s.name}</span>
                <span>{brl(data[tip.month][s.key])}</span>
              </p>
            ))}
            {marker?.[tip.month] ? <p className="mt-1 flex justify-between border-t border-zinc-800 pt-1 text-zinc-300"><span>{markerLabel}</span><span>{brl(marker[tip.month])}</span></p> : null}
          </div>
        )}
      </div>
    </div>
  )
}

export interface BarItem { key: string; label: string; cents: number; count?: number; note?: string }

/** Barras horizontais ordenadas, uma cor só: o valor vem impresso em cada linha. */
export function HBars({ items, color = RANK_BAR, empty = 'Sem dados.' }: { items: BarItem[]; color?: string; empty?: string }) {
  const max = Math.max(...items.map((i) => i.cents), 1)
  const total = items.reduce((s, i) => s + Math.max(i.cents, 0), 0) || 1
  if (!items.length) return <p className="text-sm text-zinc-500">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={i.label}>
              {i.label}
              {i.count ? <span className="ml-1.5 text-xs text-zinc-500">{i.count}x</span> : null}
              {i.note ? <span className="chip ml-2">{i.note}</span> : null}
            </span>
            <span className="shrink-0 tabular-nums">{brl(i.cents)} <span className="text-xs text-zinc-500">{Math.round((Math.max(i.cents, 0) / total) * 100)}%</span></span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-zinc-800">
            <div className="h-2 rounded-full" style={{ width: `${(Math.max(i.cents, 0) / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
