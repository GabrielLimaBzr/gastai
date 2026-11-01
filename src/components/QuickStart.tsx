'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Rocket, X } from 'lucide-react'
import { useGuideHidden, useOnboarding } from '@/hooks/useOnboarding'
import { buildSteps, progress, type Step } from '@/lib/onboarding'

function StepRow({ s, isNext }: { s: Step; isNext: boolean }) {
  return (
    <li className={`flex items-start gap-3 py-2.5 ${isNext ? 'rounded-lg bg-emerald-500/5 px-2' : ''}`}>
      <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 ${s.done ? 'border-emerald-500 bg-emerald-500 text-on-accent' : isNext ? 'border-emerald-400' : 'border-zinc-600'}`} aria-hidden>
        {s.done && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${s.done ? 'text-zinc-500 line-through' : 'font-medium'}`}>
          {s.title}{s.optional && !s.done && <span className="chip ml-2 align-middle">opcional</span>}
        </span>
        {!s.done && <span className="mt-0.5 block text-xs text-zinc-400">{s.why}</span>}
        {!s.done && <Link href={s.href} className={`${isNext ? 'btn' : 'btn-ghost'} mt-2 py-1.5`}>{s.cta}</Link>}
      </span>
    </li>
  )
}

/**
 * Guia de primeiros passos. Os itens se marcam sozinhos conforme o usuário usa o app, só o próximo passo
 * ganha destaque e nada é obrigatório. `page`: roteiro completo (tela Primeiros passos); sem `page`: cartão
 * enxuto do Resumo, que pode ser dispensado.
 */
export function QuickStart({ page = false, force = false, listOnly = false }: { page?: boolean; force?: boolean; listOnly?: boolean }) {
  const { facts } = useOnboarding()
  const [hidden, setHidden] = useGuideHidden()
  const [justHid, setJustHid] = useState(false)

  if (!facts || hidden === null) return null
  const steps = buildSteps(facts)
  const p = progress(steps)

  // no Resumo o cartão some sozinho quando o essencial está pronto; os opcionais continuam na tela Primeiros passos
  if (!page && p.essentialsDone) return null
  if (!page && hidden && !force) {
    return justHid ? <p className="text-center text-xs text-zinc-500" role="status">Guia dispensado. Para rever, abra o menu Mais e escolha Primeiros passos.</p> : null
  }

  const pct = Math.round((p.done / p.total) * 100)
  return (
    <section className="card border-emerald-500/30" aria-label="Primeiros passos">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400"><Rocket size={18} aria-hidden /></span>
          <div>
            <h2 className="font-medium leading-tight">Primeiros passos</h2>
            <p className="text-xs text-zinc-400">{p.allDone ? 'Tudo pronto!' : `${p.done} de ${p.total} · nada aqui é obrigatório`}</p>
          </div>
        </div>
        {!page && (
          <button type="button" onClick={() => { setHidden(true); setJustHid(true) }} aria-label="Dispensar o guia de primeiros passos" title="Dispensar (dá para rever no menu Mais, em Primeiros passos)"
            className="grid size-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"><X size={18} aria-hidden /></button>
        )}
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-zinc-800" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso dos primeiros passos">
        <div className="h-1.5 rounded-full bg-emerald-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>

      {p.allDone ? (
        <p className="mt-3 text-sm text-zinc-300">Você configurou tudo. Daqui em diante, é só importar a fatura de cada mês e acompanhar o Resumo, o Calendário e as Metas.</p>
      ) : page || listOnly ? (
        <ul className="mt-2 divide-y divide-zinc-800">{steps.map((s) => <StepRow key={s.id} s={s} isNext={s.id === p.next?.id} />)}</ul>
      ) : (
        <>
          {p.next && (
            <div className="mt-3 rounded-lg bg-emerald-500/5 p-3">
              <p className="text-xs font-medium text-emerald-400">Próximo passo</p>
              <p className="mt-0.5 font-medium">{p.next.title}</p>
              <p className="mt-0.5 text-sm text-zinc-400">{p.next.why}</p>
              <Link href={p.next.href} className="btn mt-3">{p.next.cta} <ArrowRight size={16} aria-hidden /></Link>
            </div>
          )}
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer py-1 text-zinc-400">Ver todos os passos</summary>
            <ul className="divide-y divide-zinc-800">{steps.map((s) => <StepRow key={s.id} s={s} isNext={s.id === p.next?.id} />)}</ul>
          </details>
        </>
      )}
      {page && hidden && <button className="btn-ghost mt-3" onClick={() => setHidden(false)}>Mostrar este guia no Resumo</button>}
    </section>
  )
}
