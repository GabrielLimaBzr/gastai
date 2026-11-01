'use client'
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, OctagonX, Trash2 } from 'lucide-react'
import { useTransactions } from '@/hooks/useData'
import { useCategories } from '@/hooks/useCategories'
import { monthLabel } from '@/components/charts'
import { palette } from '@/lib/palette'
import { DEFAULT_NAMES } from '@/lib/categorize'
import { categorize, monthsDesc } from '@/lib/ledger'
import { goalStatus, suggestGoal, type GoalState } from '@/lib/goals'
import { categoryByMonth, categorySeries } from '@/lib/trends'
import { brl, toCents, toInput } from '@/lib/money'
import { useSharedMonth } from '@/contexts/month'
import { friendlyError } from '@/lib/errors'
import { PageSkeleton } from '@/components/ui'
import { MonthSwitcher, PageHeader } from '@/components/ui'

// estado = ícone + palavra + cor (nunca só a cor)
const LOOK: Record<GoalState, { label: string; bar: GoalState; text: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: 'Dentro da meta', bar: 'ok', text: 'text-emerald-400', Icon: CheckCircle2 },
  near: { label: 'Perto do limite', bar: 'near', text: 'text-amber-400', Icon: AlertTriangle },
  over: { label: 'Passou da meta', bar: 'over', text: 'text-red-400', Icon: OctagonX },
}

export default function Goals() {
  const { rows, loading } = useTransactions()
  const { cats, ready, setGoal } = useCategories()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [msg, setMsg] = useState('')

  const catName = useMemo(() => new Map(cats.map((c) => [c.id, c.name])), [cats])
  const byMonth = useMemo(
    () => categoryByMonth(rows, (r) => categorize(r.description, r.category_id ? catName.get(r.category_id) : null).name),
    [rows, catName],
  )
  const months = useMemo(() => monthsDesc(rows), [rows])
  const [month, setMonth] = useSharedMonth(months, months[0] ?? '')

  const withGoal = cats.filter((c) => c.goal_cents).map((c) => ({ ...c, used: Math.max(byMonth.get(month)?.get(c.name) ?? 0, 0) }))
  const options = [...new Set([...DEFAULT_NAMES, ...cats.map((c) => c.name)])].filter((n) => !cats.find((c) => c.name === n)?.goal_cents)
  const asc = [...months].reverse()
  const suggestion = name ? suggestGoal(categorySeries(byMonth, asc, name)) : null

  async function save(n: string, cents: number | null) {
    setMsg('')
    try { await setGoal(n, cents); setMsg(cents ? `Meta de «${n}»: ${brl(cents)} por mês.` : `Meta de «${n}» removida.`) }
    catch (e) { setMsg(friendlyError(e, 'salvar a meta')) }
  }
  async function add() {
    const cents = toCents(value)
    if (!name || !(cents > 0)) return setMsg('Escolha a categoria e informe um valor maior que zero.')
    await save(name, cents); setName(''); setValue('')
  }
  async function edit(n: string, current: number) {
    const v = prompt(`Nova meta mensal para «${n}» (R$):`, toInput(current))
    if (!v) return
    const cents = toCents(v)
    if (cents > 0) await save(n, cents)
  }

  if (loading || !ready) return <PageSkeleton />

  return (
    <div className="space-y-4">
      <PageHeader title="Metas" description="Defina um limite mensal por categoria e acompanhe quanto já foi usado em cada fatura."
        actions={months.length > 0 ? <MonthSwitcher value={month} onChange={setMonth} options={months} label="Mês da fatura" /> : undefined} />
      {msg && <p className="text-sm text-emerald-400" role="status">{msg}</p>}

      {!withGoal.length ? (
        <p className="card text-sm text-zinc-400">Nenhuma meta ainda. Crie a primeira abaixo, por exemplo uma para Delivery e restaurantes.</p>
      ) : (
        <ul className="space-y-3">
          {withGoal.map((c) => {
            const goal = c.goal_cents!, st = goalStatus(c.used, goal), look = LOOK[st.state]
            return (
              <li key={c.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{c.name}</span>
                    <span className={`inline-flex items-center gap-1 text-xs ${look.text}`}><look.Icon size={14} aria-hidden />{look.label}</span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    {brl(c.used)} <span className="text-xs text-zinc-500">de {brl(goal)}</span>
                    <span className={`block text-xs ${look.text}`}>{st.left >= 0 ? `restam ${brl(st.left)}` : `${brl(-st.left)} acima`} · {Math.round(st.pct * 100)}%</span>
                  </span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-zinc-800" role="progressbar" aria-valuenow={Math.round(st.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name}: ${Math.round(st.pct * 100)}% da meta`}>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(st.pct, 1) * 100}%`, background: palette().goal[look.bar] }} />
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-ghost" onClick={() => edit(c.name, goal)}>Editar meta</button>
                  <button className="btn-ghost text-red-300" onClick={() => save(c.name, null)} aria-label={`Remover meta de ${c.name}`}><Trash2 size={14} aria-hidden /> Remover</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <section className="card space-y-3">
        <h2 className="font-medium">Nova meta</h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <select className="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Categoria">
            <option value="">Escolher categoria…</option>
            {options.map((n) => <option key={n}>{n}</option>)}
          </select>
          <input className="input" inputMode="decimal" placeholder="Limite mensal (R$)" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Limite mensal" />
          <button className="btn" onClick={add}>Definir meta</button>
        </div>
        {suggestion && (
          <button className="text-left text-xs text-emerald-400" onClick={() => setValue(toInput(suggestion))}>
            Sugestão: {brl(suggestion)} (média dos últimos meses menos 10%) — toque para usar
          </button>
        )}
      </section>
    </div>
  )
}
