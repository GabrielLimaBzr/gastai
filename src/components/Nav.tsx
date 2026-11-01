'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, CalendarClock, CalendarDays, Layers, ListOrdered, LogOut, MoreHorizontal, PieChart, Target, TrendingUp, TriangleAlert, Upload, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MAIN = [
  { href: '/', label: 'Resumo', Icon: BarChart3 },
  { href: '/transactions', label: 'Transações', Icon: ListOrdered },
  { href: '/analysis', label: 'Análise', Icon: PieChart },
  { href: '/import', label: 'Importar', Icon: Upload },
] as const
const MORE = [
  { href: '/trends', label: 'Tendências', Icon: TrendingUp },
  { href: '/goals', label: 'Metas', Icon: Target },
  { href: '/calendar', label: 'Calendário', Icon: CalendarDays },
  { href: '/installments', label: 'Parcelas', Icon: Layers },
  { href: '/bills', label: 'Contas fixas', Icon: CalendarClock },
  { href: '/anomalies', label: 'Anomalias', Icon: TriangleAlert },
] as const

export function Nav({ email }: { email?: string }) {
  const path = usePathname()
  const router = useRouter()
  const [more, setMore] = useState(false)

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
  }
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href))

  return (
    <>
      {/* Desktop: barra no topo */}
      <header className="mb-6 hidden flex-wrap items-center gap-1 border-b border-zinc-800 pb-3 md:flex">
        <span className="mr-4 font-semibold text-emerald-400">GastAI</span>
        {[...MAIN, ...MORE].map(({ href, label }) => (
          <Link key={href} href={href}
            className={`rounded-md px-2.5 py-1.5 text-sm ${active(href) ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {label}
          </Link>
        ))}
        <span className="ml-auto text-xs text-zinc-600">{email}</span>
        <button className="ml-3 text-sm text-zinc-500 hover:text-white" onClick={signOut}>Sair</button>
      </header>

      {/* Celular: título no topo + barra de abas embaixo (alcance do polegar) */}
      <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2.5 border-b border-zinc-900 bg-zinc-950/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" width={28} height={28} className="size-7 rounded-lg" />
        <span className="text-lg font-semibold text-emerald-400">GastAI</span>
      </header>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden" aria-label="Navegação">
        <ul className="grid grid-cols-5">
          {MAIN.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link href={href} onClick={() => setMore(false)}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(href) ? 'text-emerald-400' : 'text-zinc-500'}`}>
                <Icon size={20} aria-hidden /> {label}
              </Link>
            </li>
          ))}
          <li>
            <button onClick={() => setMore((v) => !v)}
              className={`flex w-full flex-col items-center gap-0.5 py-2 text-[11px] ${more || MORE.some((m) => active(m.href)) ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {more ? <X size={20} aria-hidden /> : <MoreHorizontal size={20} aria-hidden />} Mais
            </button>
          </li>
        </ul>
      </nav>
      {more && (
        <div className="fixed inset-0 z-30 md:hidden" onClick={() => setMore(false)}>
          <div className="safe-bottom absolute inset-x-3 bottom-16 rounded-xl border border-zinc-800 bg-zinc-900 p-2 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {MORE.map(({ href, label, Icon }) => (
              <Link key={href} href={href} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-zinc-800">
                <Icon size={18} aria-hidden /> {label}
              </Link>
            ))}
            <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 hover:bg-zinc-800">
              <LogOut size={18} aria-hidden /> Sair <span className="ml-auto truncate text-xs text-zinc-600">{email}</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
