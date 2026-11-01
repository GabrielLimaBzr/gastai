'use client'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthLabel } from '@/components/charts'

/** Cabeçalho de página: título, apoio opcional e ações (ex.: seletor de mês) alinhadas à direita. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 md:mb-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 text-[1.65rem] font-semibold leading-tight tracking-tight md:text-3xl">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="mt-1.5 max-w-prose text-sm text-zinc-400">{description}</p>}
    </header>
  )
}

/**
 * Seletor de mês com setas. Com `options` (mais recente primeiro) percorre só os meses que têm dados;
 * sem `options` (calendário) usa `onStep` e anda por qualquer mês.
 */
export function MonthSwitcher({ value, onChange, options, onStep, label = 'Mês' }: {
  value: string; onChange: (m: string) => void; options?: string[]; onStep?: (delta: -1 | 1) => void; label?: string
}) {
  const i = options ? options.indexOf(value) : -1
  const canPrev = options ? i >= 0 && i < options.length - 1 : true
  const canNext = options ? i > 0 : true
  const prev = () => (options ? onChange(options[i + 1]) : onStep?.(-1))
  const next = () => (options ? onChange(options[i - 1]) : onStep?.(1))
  const arrow = 'grid size-10 place-items-center text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:pointer-events-none disabled:opacity-30'
  return (
    <div className="inline-flex items-center overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900" role="group" aria-label={label}>
      <button type="button" className={arrow} onClick={prev} disabled={!canPrev} aria-label="Mês anterior"><ChevronLeft size={18} aria-hidden /></button>
      {options ? (
        <label className="relative">
          <span className="sr-only">{label}</span>
          <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 min-w-24 cursor-pointer appearance-none bg-transparent px-2 text-center text-sm font-medium text-zinc-100">
            {options.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      ) : (
        <span className="min-w-24 px-2 text-center text-sm font-medium" aria-live="polite">{monthLabel(value)}</span>
      )}
      <button type="button" className={arrow} onClick={next} disabled={!canNext} aria-label="Próximo mês"><ChevronRight size={18} aria-hidden /></button>
    </div>
  )
}

/** Abas (`tabs`) ou alternância (padrão) em controle segmentado. */
export function Segmented<T extends string>({ value, onChange, options, label, tabs = false, className = '' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; tabs?: boolean; className?: string
}) {
  return (
    <div className={`seg ${className}`} role={tabs ? 'tablist' : 'group'} aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role={tabs ? 'tab' : undefined} aria-selected={tabs ? value === o.value : undefined} aria-pressed={tabs ? undefined : value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export const Skeleton = ({ className = '' }: { className?: string }) => <div className={`animate-pulse rounded-2xl bg-zinc-800/70 ${className}`} aria-hidden />

/** Esqueleto de carregamento: mantém o layout no lugar em vez de um texto "Carregando…". */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Carregando">
      <div className="mb-6 flex items-end justify-between gap-4"><Skeleton className="h-9 w-40" /><Skeleton className="h-10 w-36" /></div>
      <Skeleton className="mb-6 h-44 rounded-3xl" />
      <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      <span className="sr-only">Carregando…</span>
    </div>
  )
}

/** Tela vazia como convite para agir: o que falta, por quê, e o próximo passo. */
export function EmptyState({ icon: Icon, title, children, action }: { icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-zinc-700 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-zinc-800 text-zinc-400"><Icon size={22} aria-hidden /></span>
      <h2 className="font-medium">{title}</h2>
      {children && <p className="max-w-sm text-sm text-zinc-400">{children}</p>}
      {action}
    </div>
  )
}

const TONES = {
  info: 'border-sky-500/30 bg-sky-500/10',
  warn: 'border-amber-500/40 bg-amber-500/10',
  danger: 'border-red-500/40 bg-red-500/10',
  ok: 'border-emerald-500/30 bg-emerald-500/10',
} as const

/** Aviso em linha. Com `href` vira link inteiro (com seta de ícone, sem "→" no texto). */
export function Notice({ tone = 'info', icon: Icon, href, children }: { tone?: keyof typeof TONES; icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>; href?: string; children: React.ReactNode }) {
  const box = `flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm ${TONES[tone]}`
  const inner = (
    <>
      <Icon size={18} className="shrink-0 text-zinc-300" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {href && <ChevronRight size={18} className="shrink-0 text-zinc-400" aria-hidden />}
    </>
  )
  return href ? <Link href={href} className={`${box} transition-colors hover:brightness-95`}>{inner}</Link> : <div className={box}>{inner}</div>
}
