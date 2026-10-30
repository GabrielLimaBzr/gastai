'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl, toCents } from '@/lib/money'

interface Bill { id: string; name: string; expected_cents: number; due_day: number }

export default function Bills() {
  const supabase = createClient()
  const [bills, setBills] = useState<Bill[]>([])
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [day, setDay] = useState('5')

  const load = useCallback(async () => {
    const { data } = await supabase.from('recurring_bills').select('id,name,expected_cents,due_day').eq('active', true).order('due_day')
    setBills((data as Bill[]) ?? [])
  }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    if (!name || !value) return
    await supabase.from('recurring_bills').insert({ name, expected_cents: toCents(value), due_day: +day })
    setName(''); setValue(''); load()
  }
  const total = bills.reduce((s, b) => s + b.expected_cents, 0)

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-2">
        <input className="input flex-1" placeholder="Conta (ex: Aluguel)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input w-32" placeholder="Valor" value={value} onChange={(e) => setValue(e.target.value)} />
        <input className="input w-20" type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} />
        <button className="btn" onClick={add}>Adicionar</button>
      </div>
      <div className="card divide-y divide-zinc-800 p-0">
        {bills.map((b) => (
          <div key={b.id} className="flex justify-between px-4 py-2 text-sm">
            <span>{b.name} <span className="text-zinc-500">dia {b.due_day}</span></span>
            <span>{brl(b.expected_cents)}</span>
          </div>
        ))}
      </div>
      <p className="text-right text-sm text-zinc-400">Total fixo mensal: <b className="text-white">{brl(total)}</b></p>
    </div>
  )
}
