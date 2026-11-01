'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBills, type Bill } from '@/hooks/useBills'
import { brl, toCents, toInput } from '@/lib/money'

export default function Bills() {
  const supabase = createClient()
  const { bills, reload } = useBills()
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [day, setDay] = useState('5')
  const [variable, setVariable] = useState(false)
  const [msg, setMsg] = useState('')

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setMsg('')
    const { error } = await fn()
    if (error) return setMsg(`Não salvou: ${error.message}`)
    reload()
  }
  async function add() {
    const cents = toCents(value)
    if (!name.trim() || !(cents > 0)) return setMsg('Informe o nome e um valor maior que zero.')
    await run(() => supabase.from('recurring_bills').insert({ name: name.trim(), expected_cents: cents, due_day: +day, variable }))
    setName(''); setValue(''); setVariable(false)
  }
  function editValue(b: Bill) {
    const v = prompt(`${b.variable ? 'Estimativa' : 'Valor'} mensal de «${b.name}» (R$):`, toInput(b.expected_cents))
    const cents = v ? toCents(v) : 0
    if (cents > 0) run(() => supabase.from('recurring_bills').update({ expected_cents: cents }).eq('id', b.id))
  }

  const fixed = bills.filter((b) => !b.variable).reduce((s, b) => s + b.expected_cents, 0)
  const est = bills.filter((b) => b.variable).reduce((s, b) => s + b.expected_cents, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Contas fixas e variáveis</h1>
      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 basis-full md:basis-0 md:flex-1" placeholder="Conta (ex: Aluguel, Energia)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input w-36" inputMode="decimal" placeholder={variable ? 'Estimativa (R$)' : 'Valor (R$)'} value={value} onChange={(e) => setValue(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-zinc-400">Vence dia
            <input className="input w-20" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
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
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="break-words font-medium">{b.name}</span>{' '}
                  <span className="text-zinc-500">vence dia {b.due_day}</span>
                  {b.variable && <span className="chip ml-2">variável</span>}
                </span>
                <span className="shrink-0 tabular-nums">{b.variable && '~'}{brl(b.expected_cents)}{b.variable && <span className="text-xs text-zinc-500"> estim.</span>}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => editValue(b)}>{b.variable ? 'Editar estimativa' : 'Editar valor'}</button>
                <button className="btn-ghost" onClick={() => run(() => supabase.from('recurring_bills').update({ variable: !b.variable }).eq('id', b.id))}>
                  {b.variable ? 'Tornar fixa' : 'Tornar variável'}
                </button>
                <button className="btn-ghost text-red-300" onClick={() => { if (confirm(`Remover «${b.name}»? Os meses já pagos continuam no histórico.`)) run(() => supabase.from('recurring_bills').update({ active: false }).eq('id', b.id)) }}>Remover</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-right text-sm text-zinc-400">
        Fixas: <b className="text-white">{brl(fixed)}</b>{est > 0 && <> · variáveis (estimativa): <b className="text-white">~{brl(est)}</b></>}
      </p>
    </div>
  )
}
