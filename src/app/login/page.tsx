'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Alert } from '@/components/Alert'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MIN_PASSWORD, validateAuth, type AuthFieldErrors, type AuthMode } from '@/lib/authForm'
import { friendlyAuthError } from '@/lib/errors'

const COPY = {
  in: { title: 'Entre na sua conta', button: 'Entrar', busy: 'Entrando…' },
  up: { title: 'Crie a sua conta', button: 'Criar conta', busy: 'Criando conta…' },
} as const

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-zinc-300">{label}</label>
      {children}
      {error ? <p id={`${id}-msg`} className="mt-1 text-sm text-red-400" role="alert">{error}</p>
        : hint ? <p id={`${id}-msg`} className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  )
}

/** Moldura das telas de entrada: folha centralizada e o seletor de tema no canto. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center px-4 py-16">
      <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] w-60"><ThemeToggle /></div>
      <main className="card w-full max-w-sm space-y-5 p-6 sm:p-8" style={{ boxShadow: 'var(--shadow-float)' }}>{children}</main>
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({})
  const [formError, setFormError] = useState<{ text: string; unconfirmed?: boolean } | null>(null)
  const [notice, setNotice] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null) // cadastro feito, falta confirmar o e-mail
  const [cooldown, setCooldown] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t) }, [cooldown])

  function switchMode(next: AuthMode) {
    setMode(next); setFieldErrors({}); setFormError(null); setNotice(''); setConfirm('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setNotice(''); setFormError(null)
    const errs = validateAuth(mode, { email, password, confirm })
    setFieldErrors(errs)
    if (Object.keys(errs).length) {
      document.getElementById(errs.email ? 'email' : errs.password ? 'password' : 'confirm')?.focus()
      return
    }
    setBusy(true)
    const auth = createClient().auth
    const addr = email.trim()
    try {
      if (mode === 'in') {
        const { error } = await auth.signInWithPassword({ email: addr, password })
        if (error) return setFormError({ text: friendlyAuthError(error), unconfirmed: /email_not_confirmed/.test(String((error as { code?: string }).code)) })
        router.replace('/'); router.refresh()
        return
      }
      const { data, error } = await auth.signUp({ email: addr, password })
      if (error) return setFormError({ text: friendlyAuthError(error) })
      if (data.user && data.user.identities?.length === 0) { // e-mail já cadastrado (o servidor não revela com erro)
        return setFormError({ text: friendlyAuthError({ error_code: 'user_already_exists' }) })
      }
      if (data.session) { router.replace('/'); router.refresh(); return }
      setSentTo(addr); setCooldown(60) // conta criada, mas exige confirmar o e-mail
    } catch (err) {
      setFormError({ text: friendlyAuthError(err as Error) })
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    const addr = (sentTo ?? email).trim()
    if (!addr || cooldown > 0) return
    setBusy(true); setFormError(null); setNotice('')
    const { error } = await createClient().auth.resend({ type: 'signup', email: addr })
    setBusy(false)
    if (error) return setFormError({ text: friendlyAuthError(error) })
    setNotice(`E-mail reenviado para ${addr}. Pode levar alguns minutos para chegar.`); setCooldown(60)
  }

  const field = 'input'
  const bad = (k: keyof AuthFieldErrors) => (fieldErrors[k] ? 'border-red-500/70' : '')

  if (sentTo) {
    return (
      <AuthShell>
        <div className="space-y-3 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-500/10 text-emerald-400"><MailCheck size={28} aria-hidden /></span>
          <h1 className="text-xl font-semibold">Confirme o seu e-mail</h1>
          <p className="text-sm text-zinc-400">Enviamos um link para <b className="text-zinc-100">{sentTo}</b>. Abra o e-mail, toque no link e depois volte aqui para entrar. Se não achar, veja a caixa de spam.</p>
        </div>
        {notice && <Alert kind="success">{notice}</Alert>}
        {formError && <Alert>{formError.text}</Alert>}
        <button className="btn w-full" onClick={() => { setSentTo(null); switchMode('in'); setPassword('') }}>Já confirmei — entrar</button>
        <button className="btn-ghost w-full" onClick={resend} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Reenviar e-mail (aguarde ${cooldown}s)` : 'Reenviar e-mail'}
        </button>
        <button className="w-full text-sm text-zinc-500" onClick={() => { setSentTo(null); switchMode('up') }}>Digitei o e-mail errado</button>
      </AuthShell>
    )
  }

  const t = COPY[mode]
  return (
    <AuthShell>
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={40} height={40} className="size-10 rounded-xl" />
        <div><h1 className="text-xl font-semibold leading-tight">GastAI</h1><p className="text-sm text-zinc-400">{t.title}</p></div>
      </header>

      <div className="grid grid-cols-2 rounded-lg border border-zinc-700 p-0.5 text-sm" role="tablist" aria-label="Entrar ou criar conta">
        {(['in', 'up'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)}
            className={`rounded-md py-2 font-medium ${mode === m ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}`}>{COPY[m].button}</button>
        ))}
      </div>

      <form onSubmit={submit} noValidate className="space-y-4">
        {formError && (
          <Alert action={formError.unconfirmed && <button type="button" className="underline" onClick={() => { setSentTo(email.trim()); resend() }}>Reenviar e-mail de confirmação</button>}>
            {formError.text}
          </Alert>
        )}
        <Field id="email" label="E-mail" error={fieldErrors.email}>
          <input ref={emailRef} id="email" className={`${field} ${bad('email')}`} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoFocus
            placeholder="nome@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'email-msg' : undefined} />
        </Field>
        <Field id="password" label="Senha" error={fieldErrors.password} hint={mode === 'up' ? `Pelo menos ${MIN_PASSWORD} caracteres.` : undefined}>
          <div className="relative">
            <input id="password" className={`${field} pr-11 ${bad('password')}`} type={show ? 'text' : 'password'} autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password || mode === 'up' ? 'password-msg' : undefined} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center text-zinc-400 hover:text-zinc-200">
              {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
            </button>
          </div>
        </Field>
        {mode === 'up' && (
          <Field id="confirm" label="Confirmar senha" error={fieldErrors.confirm}>
            <input id="confirm" className={`${field} ${bad('confirm')}`} type={show ? 'text' : 'password'} autoComplete="new-password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={!!fieldErrors.confirm} aria-describedby={fieldErrors.confirm ? 'confirm-msg' : undefined} />
          </Field>
        )}
        <button className="btn w-full py-2.5 text-base" type="submit" disabled={busy}>
          {busy ? <><Loader2 size={18} className="animate-spin" aria-hidden /> {t.busy}</> : t.button}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        {mode === 'in' ? <>Primeira vez aqui?{' '}<button className="text-emerald-400" onClick={() => switchMode('up')}>Criar conta</button></>
          : <>Já tem conta?{' '}<button className="text-emerald-400" onClick={() => switchMode('in')}>Entrar</button></>}
      </p>
    </AuthShell>
  )
}
