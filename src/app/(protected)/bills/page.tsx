'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBills, type Bill } from '@/hooks/useBills'
import { brl, toCents, toInput } from '@/lib/money'
import { friendlyError } from '@/lib/errors'
import { PageHeader } from '@/components/ui'
import { DayInput, MoneyInput } from '@/components/MoneyInput'
import { useDialogs } from '@/contexts/dialogs'
import { moneyField } from '@/lib/mask'

export default function Bills() {
  const supabase = createClient()
  const { bills, reload } = useBills()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [day, setDay] = useState('5')
  const [variable, setVariable] = useState(false)
  const [msg, setMsg] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const { confirm } = useDialogs()
  const [draft, setDraft] = useState({ name: '', value: '', day: '' })

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setMsg('')
    const { error } = await fn()
    if (error) return setMsg(friendlyError(error, 'salvar a conta'))
    reload()
  }
  async function add() {
    const cents = toCents(value)
    if (!name.trim() || !(cents > 0)) return setMsg('Informe o nome e um valor maior que zero.')
    const d = Math.trunc(+day)
    if (!(d >= 1 && d <= 31)) return setMsg('O dia do vencimento precisa estar entre 1 e 31.')
    await run(() => supabase.from('recurring_bills').insert({ name: name.trim(), expected_cents: cents, due_day: d, variable }))
    setName(''); setValue(''); setVariable(false)
  }
  function startEdit(b: Bill) {
    setMsg('')
    setDraft({ name: b.name, value: moneyField(b.expected_cents), day: String(b.due_day) })
    setEditing(b.id)
  }
  async function saveEdit(b: Bill) {
    const cents = toCents(draft.value)
    const d = Math.trunc(+draft.day)
    if (!draft.name.trim() || !(cents > 0)) return setMsg('Informe o nome e um valor maior que zero.')
    if (!(d >= 1 && d <= 31)) return setMsg('O dia do vencimento precisa estar entre 1 e 31.')
    await run(() => supabase.from('recurring_bills').update({ name: draft.name.trim(), expected_cents: cents, due_day: d }).eq('id', b.id))
    setEditing(null)
  }

  const fixed = bills.filter((b) => !b.variable).reduce((s, b) => s + b.expected_cents, 0)
  const est = bills.filter((b) => b.variable).reduce((s, b) => s + b.expected_cents, 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Contas fixas e variáveis" description="Aluguel, internet, luz… entram no total do mês e no Calendário." />
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 basis-full md:basis-0 md:flex-1" placeholder="Conta (ex: Aluguel, Energia)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="w-40"><MoneyInput placeholder={variable ? 'Estimativa' : 'Valor'} aria-label={variable ? 'Estimativa' : 'Valor'} value={value} onValueChange={setValue} /></div>
          <label className="flex items-center gap-2 text-sm text-zinc-400">Vence dia
            <DayInput className="w-16" aria-label="Dia do vencimento" value={day} onValueChange={setDay} />
          </label>
          <button className="btn" onClick={add}>Adicionar</button>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
          <input type="checkbox" className="mt-0.5 size-4 accent-emerald-500" checked={variable} onChange={(e) => setVariable(e.target.checked)} />
          <span>O valor muda todo mês (luz, água, internet por consumo…)
            <span className="block text-xs text-zinc-500">Você informa o valor real no Calendário quando a conta chega. Até lá, o app usa a estimativa ou o valor do mês anterior.</span>
          </span>
        </label>
        {msg && <p className="text-sm text-amber-300" role="status">{msg}</p>}
      </div>

      {!bills.length ? (
        <p className="card text-sm text-zinc-400">Nenhuma conta cadastrada ainda.</p>
      ) : (
        <ul className="card divide-y divide-zinc-800 p-0">
          {bills.map((b) => (
            <li key={b.id} className="space-y-2 px-4 py-3 text-sm">
              {editing === b.id ? (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); saveEdit(b) }}>
                  <div className="flex flex-wrap gap-3">
                    <label className="block min-w-0 basis-full text-xs text-zinc-400 sm:basis-0 sm:flex-1">Nome
                      <input className="input mt-1 w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    </label>
                    <label className="block text-xs text-zinc-400">{b.variable ? 'Estimativa (R$)' : 'Valor (R$)'}
                      <div className="mt-1 w-40"><MoneyInput value={draft.value} onValueChange={(v) => setDraft({ ...draft, value: v })} /></div>
                    </label>
                    <label className="block text-xs text-zinc-400">Vence dia
                      <DayInput className="mt-1 w-24" value={draft.day} onValueChange={(v) => setDraft({ ...draft, day: v })} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn">Salvar</button>
                    <button type="button" className="btn-ghost" onClick={() => { setEditing(null); setMsg('') }}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      <span className="break-words font-medium">{b.name}</span>{' '}
                      <span className="text-zinc-500">vence dia {b.due_day}</span>
                      {b.variable && <span className="chip ml-2">variável</span>}
                    </span>
                    <span className="shrink-0 tabular-nums">{b.variable && '~'}{brl(b.expected_cents)}{b.variable && <span className="text-xs text-zinc-500"> estim.</span>}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost" onClick={() => startEdit(b)}>Editar</button>
                    <button className="btn-ghost" onClick={() => run(() => supabase.from('recurring_bills').update({ variable: !b.variable }).eq('id', b.id))}>
                      {b.variable ? 'Tornar fixa' : 'Tornar variável'}
                    </button>
                    <button className="btn-ghost text-red-300" onClick={async () => { if (await confirm({ title: `Remover ${b.name}?`, description: 'Os meses já pagos continuam no histórico.', confirmLabel: 'Remover', danger: true })) run(() => supabase.from('recurring_bills').update({ active: false }).eq('id', b.id)) }}>Remover</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-right text-sm text-zinc-400">
        Fixas: <b className="text-zinc-100">{brl(fixed)}</b>{est > 0 && <> · variáveis (estimativa): <b className="text-zinc-100">~{brl(est)}</b></>}
      </p>
    </div>
  )
}
