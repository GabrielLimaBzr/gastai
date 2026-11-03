'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { moneyField } from '@/lib/mask'
import { toCents } from '@/lib/money'

interface Common { title: string; description?: string; confirmLabel?: string }
type Req =
  | ({ kind: 'money'; initialCents?: number | null } & Common)
  | ({ kind: 'text'; initial?: string; placeholder?: string } & Common)
  | ({ kind: 'confirm'; danger?: boolean } & Common)

interface Api {
  /** Pede um valor em R$ com máscara. Devolve centavos (>0) ou null se cancelou. */
  askMoney: (o: Omit<Extract<Req, { kind: 'money' }>, 'kind'>) => Promise<number | null>
  askText: (o: Omit<Extract<Req, { kind: 'text' }>, 'kind'>) => Promise<string | null>
  confirm: (o: Omit<Extract<Req, { kind: 'confirm' }>, 'kind'>) => Promise<boolean>
}

const Ctx = createContext<Api | null>(null)
export const useDialogs = (): Api => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useDialogs precisa estar dentro de <DialogProvider>')
  return c
}

/** Diálogos do próprio app no lugar de prompt()/confirm() do navegador: aceitam máscara e seguem o tema. */
export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Req | null>(null)
  const resolver = useRef<(v: unknown) => void>(() => {})

  const open = useCallback(<T,>(r: Req) => new Promise<T>((res) => { resolver.current = res as (v: unknown) => void; setReq(r) }), [])
  const api: Api = {
    askMoney: (o) => open({ kind: 'money', ...o }),
    askText: (o) => open({ kind: 'text', ...o }),
    confirm: (o) => open({ kind: 'confirm', ...o }),
  }
  const close = (v: unknown) => { setReq(null); resolver.current(v) }

  return (
    <Ctx.Provider value={api}>
      {children}
      {req && <DialogView key={req.title + req.kind} req={req} onClose={close} />}
    </Ctx.Provider>
  )
}

function DialogView({ req, onClose }: { req: Req; onClose: (v: unknown) => void }) {
  const [text, setText] = useState(req.kind === 'money' ? (req.initialCents ? moneyField(req.initialCents) : '') : req.kind === 'text' ? req.initial ?? '' : '')
  const [err, setErr] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const cancelValue = req.kind === 'confirm' ? false : null

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('input')?.focus()
    if (req.kind === 'confirm') box.current?.querySelector<HTMLElement>('button[data-ok]')?.focus()
    return () => prev?.focus?.()
  }, [req.kind])

  function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (req.kind === 'confirm') return onClose(true)
    if (req.kind === 'money') {
      const c = toCents(text || '0')
      if (!(c > 0)) return setErr('Informe um valor maior que zero.')
      return onClose(c)
    }
    if (!text.trim()) return setErr('Preencha o campo.')
    onClose(text.trim())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(cancelValue) }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(cancelValue) }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={req.title}
        className="w-full max-w-md animate-[sheet-in_.18s_ease-out] rounded-t-3xl border border-zinc-800 bg-zinc-900 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[var(--shadow-sheet)] sm:rounded-3xl">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{req.title}</h2>
            {req.description && <p className="mt-1 text-sm text-zinc-400">{req.description}</p>}
          </div>
          {req.kind === 'money' && <MoneyInput value={text} onValueChange={(v) => { setText(v); setErr('') }} aria-label={req.title} />}
          {req.kind === 'text' && <input className="input w-full" value={text} placeholder={req.placeholder} aria-label={req.title} onChange={(e) => { setText(e.target.value); setErr('') }} />}
          {err && <p className="text-sm text-amber-300" role="alert">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => onClose(cancelValue)}>Cancelar</button>
            <button type="submit" data-ok className={req.kind === 'confirm' && req.danger ? 'btn bg-red-500 text-white hover:bg-red-400' : 'btn'}>{req.confirmLabel ?? (req.kind === 'confirm' ? 'Confirmar' : 'Salvar')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
