'use client'
import { useState } from 'react'
import { friendlyError } from '@/lib/errors'

/** Campo do dia de vencimento da fatura (1–31). Só mostra "Salvar" quando o valor muda. */
export function DueDayField({ value, onSave, label = 'Vence dia' }: { value: number | null; onSave: (day: number | null) => Promise<void>; label?: string }) {
  const [text, setText] = useState(value ? String(value) : '')
  const [err, setErr] = useState('')
  const day = text === '' ? null : Number(text)
  const valid = day === null || (Number.isInteger(day) && day >= 1 && day <= 31)
  const changed = day !== value

  async function save() {
    setErr('')
    try { await onSave(day) } catch (e) { setErr(friendlyError(e, 'salvar o dia')) }
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm text-zinc-400">
      <label className="flex items-center gap-2">{label}
        <input type="number" inputMode="numeric" min={1} max={31} value={text} onChange={(e) => setText(e.target.value)} placeholder="—"
          className="input w-20 py-1.5" aria-label={label} />
      </label>
      {changed && valid && <button type="button" className="btn py-1.5" onClick={save}>Salvar</button>}
      {!valid && <span className="text-xs text-amber-300">use um dia de 1 a 31</span>}
      {err && <span className="text-xs text-amber-300">{err}</span>}
    </span>
  )
}
