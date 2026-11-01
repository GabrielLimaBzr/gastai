'use client'
import { useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { bankOfAccount } from '@/lib/bank'
import { cardStyle, type CardAccount } from '@/lib/cards'
import { colorWarnings, isHex } from '@/lib/color'
import { PRESET_COLORS } from '@/lib/palette'
import { DueDayField } from '@/components/DueDayField'

/** Lista dos cartões com a cor de cada um; tocar na cor abre as opções (ou uma cor livre). */
export function CardColors({ accounts, onChanged }: { accounts: (CardAccount & { due_day?: number | null })[]; onChanged: () => void }) {
  const supabase = createClient()
  const [open, setOpen] = useState<string | null>(null)
  const [custom, setCustom] = useState<string | null>(null) // cor livre ainda não aplicada
  const [msg, setMsg] = useState('')

  async function save(id: string, color: string | null) {
    setMsg('')
    const { error } = await supabase.from('accounts').update({ color }).eq('id', id)
    if (error) return setMsg(`Não consegui salvar a cor: ${error.message}`)
    setCustom(null)
    onChanged()
  }

  if (!accounts.length) return null
  return (
    <ul className="divide-y divide-zinc-800">
      {accounts.map((a) => {
        const { color } = cardStyle(accounts, a.id)
        const isOpen = open === a.id
        const own = isHex(a.color)
        const others = accounts.filter((x) => x.id !== a.id).map((x) => cardStyle(accounts, x.id))
        const warnings = isOpen ? colorWarnings(color, others) : []
        return (
          <li key={a.id} className="py-2">
            <button type="button" onClick={() => { setOpen(isOpen ? null : a.id); setCustom(null) }} aria-expanded={isOpen}
              className="flex w-full items-center gap-3 rounded-lg text-left">
              <span className="size-8 shrink-0 rounded-lg border border-white/10" style={{ background: color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{a.name}</span>
                <span className="text-xs text-zinc-500">{own ? 'cor personalizada' : bankOfAccount(a.name) ? 'cor do banco' : 'cor automática'}{a.due_day ? ` · vence dia ${a.due_day}` : ''}</span>
              </span>
              <span className="text-xs text-emerald-400">{isOpen ? 'Fechar' : 'Mudar cor'}</span>
            </button>
            {isOpen && (
              <div className="mt-3 space-y-3 rounded-lg border border-zinc-800 p-3">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Cor do cartão ${a.name}`}>
                  {PRESET_COLORS.map((p) => {
                    const selected = color.toLowerCase() === p.hex
                    return (
                      <button key={p.hex} type="button" role="radio" aria-checked={selected} aria-label={p.name} title={p.name} onClick={() => save(a.id, p.hex)}
                        className={`grid size-9 place-items-center rounded-full border-2 ${selected ? 'border-white' : 'border-transparent'}`} style={{ background: p.hex }}>
                        {selected && <Check size={16} className="text-white drop-shadow" aria-hidden />}
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
                  <label className="flex items-center gap-2">Outra cor
                    <input type="color" value={custom ?? color} onChange={(e) => setCustom(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5" />
                  </label>
                  {custom && custom.toLowerCase() !== color.toLowerCase() && <button type="button" className="btn" onClick={() => save(a.id, custom)}>Aplicar</button>}
                  {own && <button type="button" className="btn-ghost ml-auto" onClick={() => save(a.id, null)}><RotateCcw size={14} aria-hidden /> Cor padrão</button>}
                </div>
                <DueDayField value={a.due_day ?? null} label="Fatura vence dia" onSave={async (day) => {
                  const { error } = await supabase.from('accounts').update({ due_day: day }).eq('id', a.id)
                  if (error) throw error
                  onChanged()
                }} />
                {custom && colorWarnings(custom, others).map((w) => <p key={w} className="text-xs text-amber-300">⚠ {w}</p>)}
                {warnings.map((w) => <p key={w} className="text-xs text-amber-300">⚠ {w}</p>)}
              </div>
            )}
          </li>
        )
      })}
      {msg && <li className="py-2 text-sm text-amber-300" role="status">{msg}</li>}
    </ul>
  )
}
