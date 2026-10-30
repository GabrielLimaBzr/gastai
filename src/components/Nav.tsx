'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const LINKS = [
  ['/', 'Resumo'],
  ['/transactions', 'Transações'],
  ['/bills', 'Contas fixas'],
  ['/import', 'Importar'],
  ['/anomalies', 'Anomalias'],
] as const

export function Nav({ email }: { email?: string }) {
  const path = usePathname()
  const router = useRouter()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-1 border-b border-zinc-800 pb-3">
      <span className="mr-4 font-semibold text-emerald-400">GastAI</span>
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href}
          className={`rounded-md px-3 py-1.5 text-sm ${path === href ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
          {label}
        </Link>
      ))}
      <span className="ml-auto hidden text-xs text-zinc-600 sm:inline">{email}</span>
      <button className="ml-3 text-sm text-zinc-500 hover:text-white" onClick={signOut}>Sair</button>
    </nav>
  )
}
