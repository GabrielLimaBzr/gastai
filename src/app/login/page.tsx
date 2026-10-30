'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  async function submit(mode: 'in' | 'up') {
    const auth = createClient().auth
    const { error } = mode === 'in'
      ? await auth.signInWithPassword({ email, password })
      : await auth.signUp({ email, password })
    if (error) return setErr(error.message)
    router.replace('/')
    router.refresh()
  }

  return (
    <form className="mx-auto mt-24 max-w-sm space-y-3 px-4" onSubmit={(e) => { e.preventDefault(); submit('in') }}>
      <h1 className="text-2xl font-semibold">GastAI</h1>
      <input className="input" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className="input" type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button className="btn" type="submit">Entrar</button>
        <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm" type="button" onClick={() => submit('up')}>Criar conta</button>
      </div>
    </form>
  )
}
