'use client'
import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAccounts, useTransactions } from '@/hooks/useData'
import { useBills } from '@/hooks/useBills'
import { useCardEstimates } from '@/hooks/useCardEstimates'
import { useDialogs } from '@/contexts/dialogs'
import { useSharedMonth } from '@/contexts/month'
import { addMonths, futureDetail, groupSum, monthsDesc } from '@/lib/ledger'
import { projectMonth } from '@/lib/projection'
import { cardStyle } from '@/lib/cards'
import { palette } from '@/lib/palette'
import { friendlyError } from '@/lib/errors'
import { brl, toCents } from '@/lib/money'
import { monthLabel } from '@/components/charts'
import { MoneyInput } from '@/components/MoneyInput'
import { MonthSwitcher, PageHeader, PageSkeleton, EmptyState } from '@/components/ui'

const Dot = ({ color }: { color: string }) => <i className="inline-block size-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden />

export default function Projection() {
  const supabase = createClient()
  const { askMoney, confirm } = useDialogs()
  const { rows, loading } = useTransactions()
  const accounts = useAccounts()
  const { fixedFor, ready: billsReady } = useBills()
  const [incomeByMonth, setIncomeByMonth] = useState<Record<string, number>>({})
  const [msg, setMsg] = useState('')
  const [want, setWant] = useState('')

  // a fatura em aberto é a seguinte à última importada: as parcelas dela já são conhecidas
  const latest = useMemo(() => monthsDesc(rows)[0] ?? '', [rows])
  const options = useMemo(() => (latest ? [3, 2, 1].map((k) => addMonths(latest, k)) : []), [latest])
  const [month, setMonth] = useSharedMonth(options, options[2] ?? '')
  const est = useCardEstimates(month)

  useEffect(() => {
    supabase.from('income').select('month,amount_cents').then(({ data }) => {
      const m: Record<string, number> = {}
      for (const r of data ?? []) m[(r.month as string).slice(0, 7)] = (m[(r.month as string).slice(0, 7)] ?? 0) + (r.amount_cents as number)
      setIncomeByMonth(m)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const incomeMonth = useMemo(() => {
    if (incomeByMonth[month]) return month
    return Object.keys(incomeByMonth).filter((k) => k < month).sort().pop() ?? '' // sem renda lançada: usa a do último mês informado
  }, [incomeByMonth, month])
  const income = incomeMonth ? incomeByMonth[incomeMonth] : 0

  const proj = useMemo(() => {
    if (!latest || !month) return null
    const target = futureDetail(rows, latest, 12).find((m) => m.month === month)
    const installmentsByCard = Object.fromEntries(groupSum(target?.items ?? [], (i) => i.row.account_id ?? '', (i) => i.cents).map((g) => [g.key, g.cents]))
    return projectMonth({ cards: accounts.map((a) => ({ id: a.id, name: a.name })), installmentsByCard, informedByCard: est.byCard, fixed: fixedFor(month), income })
  }, [rows, latest, month, accounts, est.byCard, fixedFor, income])

  if (loading || !billsReady) return <PageSkeleton />
  if (!latest || !proj) {
    return (
      <div className="space-y-4">
        <PageHeader title="Projeção" />
        <EmptyState icon={Plus} title="Importe uma fatura para começar">A projeção usa as parcelas das faturas já importadas e o total que você informa da fatura em aberto.</EmptyState>
      </div>
    )
  }

  async function inform(id: string, name: string, current: number | null, floor: number) {
    setMsg('')
    const cents = await askMoney({
      title: `Fatura de ${name}`,
      description: `Total da fatura de ${monthLabel(month)} até agora (o que o app do banco mostra). Já inclui as parcelas${floor ? ` (${brl(floor)} conhecidas)` : ''}.`,
      initialCents: current, confirmLabel: 'Salvar',
    })
    if (!cents) return
    try { await est.set(id, cents) } catch (e) { setMsg(friendlyError(e, 'salvar o total da fatura')) }
  }
  async function reset(id: string, name: string) {
    if (!(await confirm({ title: `Limpar o total de ${name}?`, description: 'A projeção volta a usar só as parcelas conhecidas.', confirmLabel: 'Limpar', danger: true }))) return
    try { await est.clear(id) } catch (e) { setMsg(friendlyError(e, 'limpar o total')) }
  }

  const wantCents = toCents(want || '0') || 0
  const freeAfter = proj.free - wantCents
  const pct = (v: number) => (proj.income > 0 ? Math.max(0, Math.min(100, (v / proj.income) * 100)) : 0)
  const parts = [
    { label: 'Parcelas dos cartões', cents: proj.installments, color: palette().ring[0] },
    { label: 'Compras novas', cents: proj.fresh, color: palette().ring[3] },
    { label: 'Contas fixas', cents: proj.fixed, color: palette().fixed },
  ]
  const informedAny = proj.cards.some((c) => c.informed != null)
  const over = proj.free < 0

  return (
    <div className="space-y-5">
      <PageHeader title="Projeção"
        description="Some o que já está no cartão (parcelas + total da fatura em aberto) às contas do mês e veja o que sobra da renda."
        actions={<MonthSwitcher value={month} onChange={setMonth} options={options} label="Fatura que vence em" />} />

      <section className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="text-sm text-zinc-400">{over ? 'Estouro previsto em' : 'Livre em'} {monthLabel(month)}</p>
            <p className={`text-4xl font-semibold tabular-nums tracking-tight ${over ? 'text-red-400' : 'text-emerald-400'}`}>{brl(Math.abs(proj.free))}</p>
          </div>
          <p className="text-sm text-zinc-400">{proj.income > 0 ? `${proj.usedPct}% da renda já comprometida` : 'Sem renda informada'}</p>
        </div>

        {proj.income > 0 && (
          <div>
            <div className="flex h-3 overflow-hidden rounded-full bg-zinc-800" role="img"
              aria-label={`Renda de ${brl(proj.income)}: ${parts.map((p) => `${p.label} ${brl(p.cents)}`).join(', ')}, livre ${brl(Math.max(proj.free, 0))}`}>
              {parts.map((p) => <span key={p.label} style={{ width: `${pct(p.cents)}%`, background: p.color }} />)}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              {parts.map((p) => <li key={p.label} className="flex items-center gap-1.5"><Dot color={p.color} />{p.label} <b className="tabular-nums text-zinc-200">{brl(p.cents)}</b></li>)}
              <li className="flex items-center gap-1.5"><Dot color="var(--chart-grid)" />Livre <b className="tabular-nums text-zinc-200">{brl(Math.max(proj.free, 0))}</b></li>
            </ul>
            {incomeMonth && incomeMonth !== month && <p className="mt-2 text-xs text-zinc-500">Renda de {monthLabel(month)} ainda não informada: usando a de {monthLabel(incomeMonth)} ({brl(proj.income)}). Edite no Resumo.</p>}
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-zinc-800 pt-3 text-sm sm:grid-cols-3">
          <div className="flex justify-between gap-3 sm:block"><dt className="text-zinc-400">Cartões</dt><dd className="tabular-nums font-medium">{brl(proj.cardsTotal)}</dd></div>
          <div className="flex justify-between gap-3 sm:block"><dt className="text-zinc-400">Contas fixas e variáveis</dt><dd className="tabular-nums font-medium">{brl(proj.fixed)}</dd></div>
          <div className="flex justify-between gap-3 sm:block"><dt className="text-zinc-400">Total comprometido</dt><dd className="tabular-nums font-medium">{brl(proj.committed)}</dd></div>
        </dl>
      </section>

      <section className="card">
        <h2 className="font-medium">Cada cartão</h2>
        <p className="mb-3 text-xs text-zinc-500">Informe o total da fatura em aberto (o app do banco mostra). As parcelas já conhecidas entram sozinhas; a diferença são as compras novas.</p>
        {msg && <p className="mb-2 text-sm text-amber-300" role="status">{msg}</p>}
        <ul className="divide-y divide-zinc-800">
          {proj.cards.map((c) => {
            const color = cardStyle(accounts, c.id).color
            return (
              <li key={c.id} className="space-y-2 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium"><Dot color={color} /><span className="truncate">{c.name}</span></span>
                  <span className="shrink-0 text-lg tabular-nums">{brl(c.total)}</span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-400">
                  <div><dt className="text-xs">Parcelas conhecidas</dt><dd className="tabular-nums text-zinc-200">{brl(c.installments)}</dd></div>
                  <div><dt className="text-xs">Compras novas</dt><dd className="tabular-nums text-zinc-200">{c.informed != null ? brl(c.fresh) : 'informe o total'}</dd></div>
                </dl>
                {c.informed != null && c.informed < c.installments && <p className="text-xs text-amber-300">O total informado é menor que as parcelas já conhecidas; usando as parcelas.</p>}
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={() => inform(c.id, c.name, c.informed, c.installments)}>
                    <Pencil size={14} aria-hidden /> {c.informed != null ? 'Atualizar total' : 'Informar total da fatura'}
                  </button>
                  {c.informed != null && <button className="btn-ghost" onClick={() => reset(c.id, c.name)}>Limpar</button>}
                </div>
              </li>
            )
          })}
        </ul>
        {!informedAny && <p className="mt-3 text-sm text-zinc-400">Sem totais informados, a projeção mostra só as parcelas que já vão cair.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="font-medium">Posso gastar?</h2>
        <p className="text-xs text-zinc-500">Digite uma compra e veja quanto sobra depois dela.</p>
        <div className="w-48"><MoneyInput value={want} onValueChange={setWant} aria-label="Valor da compra" placeholder="Valor da compra" /></div>
        {wantCents > 0 && (
          <p className={`rounded-xl border px-3.5 py-3 text-sm ${freeAfter >= 0 ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-red-500/40 bg-red-500/10'}`} role="status">
            {freeAfter >= 0
              ? <>Cabe: depois de {brl(wantCents)} ainda ficam <b>{brl(freeAfter)}</b> livres em {monthLabel(month)}.</>
              : <>Não cabe: faltam <b>{brl(-freeAfter)}</b> para cobrir {brl(wantCents)} em {monthLabel(month)}.</>}
            {proj.income <= 0 && ' Informe a renda no Resumo para a conta fazer sentido.'}
          </p>
        )}
      </section>
    </div>
  )
}
