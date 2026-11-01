'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, CalendarClock, CalendarDays, Layers, ListOrdered, LogOut, MoreHorizontal, PieChart, Plus, Rocket, Target, TrendingUp, TriangleAlert, Upload, X, type LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ThemeToggle'

interface Item { href: string; label: string; Icon: LucideIcon }
const GROUPS: { label: string; items: Item[] }[] = [
  { label: 'Visão geral', items: [{ href: '/', label: 'Resumo', Icon: BarChart3 }, { href: '/analysis', label: 'Análise', Icon: PieChart }, { href: '/trends', label: 'Tendências', Icon: TrendingUp }] },
  { label: 'Movimentações', items: [{ href: '/transactions', label: 'Transações', Icon: ListOrdered }, { href: '/import', label: 'Importar', Icon: Upload }, { href: '/installments', label: 'Parcelas', Icon: Layers }] },
  { label: 'Planejamento', items: [{ href: '/calendar', label: 'Calendário', Icon: CalendarDays }, { href: '/goals', label: 'Metas', Icon: Target }, { href: '/bills', label: 'Contas fixas', Icon: CalendarClock }] },
  { label: 'Ajuda', items: [{ href: '/anomalies', label: 'Anomalias', Icon: TriangleAlert }, { href: '/start', label: 'Primeiros passos', Icon: Rocket }] },
]
// o que fica fora da barra inferior do celular vai para a folha "Mais"
const TAB_HREFS = ['/', '/transactions', '/import', '/calendar']
const MORE_ITEMS = GROUPS.flatMap((g) => g.items).filter((i) => !TAB_HREFS.includes(i.href))

const isActive = (path: string, href: string) => (href === '/' ? path === '/' : path.startsWith(href))

function Brand({ size = 32 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="GastAI, ir para o Resumo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={size} height={size} className="rounded-[10px]" style={{ width: size, height: size }} />
      <span className="text-lg font-semibold tracking-tight">GastAI</span>
    </Link>
  )
}

export function AppShell({ email, children }: { email?: string; children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()
  const [more, setMore] = useState(false)
  const moreBtn = useRef<HTMLButtonElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  useEffect(() => { setMore(false) }, [path]) // trocar de tela fecha a folha

  useEffect(() => {
    if (!more) return
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMore(false); moreBtn.current?.focus() } }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [more])

  const tab = 'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors'

  return (
    <div className="min-h-dvh md:flex">
      <a href="#conteudo" className="sr-only z-[60] rounded-lg bg-zinc-900 px-3 py-2 text-sm focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Ir para o conteúdo</a>

      {/* Desktop e tablet: barra lateral com os itens agrupados */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-zinc-800 bg-zinc-900 px-3 py-5 md:flex">
        <div className="px-2"><Brand /></div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <p className="px-2.5 pb-1 text-xs font-medium text-zinc-500">{g.label}</p>
              <ul className="space-y-0.5">
                {g.items.map(({ href, label, Icon }) => {
                  const on = isActive(path, href)
                  return (
                    <li key={href}>
                      <Link href={href} aria-current={on ? 'page' : undefined}
                        className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${on ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100'}`}>
                        <Icon size={18} className={on ? 'text-emerald-500' : ''} aria-hidden /> {label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <ThemeToggle />
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="min-w-0 truncate text-xs text-zinc-500" title={email}>{email}</span>
            <button onClick={signOut} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">Sair</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Celular: barra superior enxuta (respeita o notch) */}
        <div className="sticky top-0 z-30 flex items-center border-b border-zinc-800 bg-zinc-950/85 px-4 pb-2.5 pt-[calc(0.6rem+env(safe-area-inset-top))] backdrop-blur md:hidden">
          <Brand size={28} />
        </div>
        <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-14 md:pt-8">{children}</main>
      </div>

      {/* Celular: barra inferior ao alcance do polegar, com "Importar" como ação central */}
      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-900/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5 items-end">
          {[{ href: '/', label: 'Resumo', Icon: BarChart3 }, { href: '/transactions', label: 'Transações', Icon: ListOrdered }].map(({ href, label, Icon }) => (
            <li key={href}><Link href={href} aria-current={isActive(path, href) ? 'page' : undefined} className={`${tab} ${isActive(path, href) ? 'text-emerald-500' : 'text-zinc-500'}`}><Icon size={22} aria-hidden />{label}</Link></li>
          ))}
          <li>
            <Link href="/import" aria-label="Importar fatura" aria-current={isActive(path, '/import') ? 'page' : undefined} className="flex flex-col items-center gap-0.5 pb-2 text-[11px] font-medium text-zinc-400">
              <span className="-mt-5 grid size-14 place-items-center rounded-full border-4 border-zinc-900 bg-emerald-500 shadow-[var(--shadow-float)]" style={{ color: 'var(--on-accent)' }}><Plus size={26} strokeWidth={2.5} aria-hidden /></span>
              Importar
            </Link>
          </li>
          <li><Link href="/calendar" aria-current={isActive(path, '/calendar') ? 'page' : undefined} className={`${tab} ${isActive(path, '/calendar') ? 'text-emerald-500' : 'text-zinc-500'}`}><CalendarDays size={22} aria-hidden />Calendário</Link></li>
          <li>
            <button ref={moreBtn} type="button" onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}
              className={`${tab} w-full ${more || MORE_ITEMS.some((i) => isActive(path, i.href)) ? 'text-emerald-500' : 'text-zinc-500'}`}><MoreHorizontal size={22} aria-hidden />Mais</button>
          </li>
        </ul>
      </nav>

      {more && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mais opções">
          <div className="fade-in absolute inset-0 bg-black/45" onClick={() => setMore(false)} />
          <div className="sheet-in absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-zinc-800 bg-zinc-900 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-float)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Mais</h2>
              <button ref={closeBtn} type="button" onClick={() => { setMore(false); moreBtn.current?.focus() }} aria-label="Fechar" className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800"><X size={20} aria-hidden /></button>
            </div>
            <ul className="grid grid-cols-3 gap-2">
              {MORE_ITEMS.map(({ href, label, Icon }) => (
                <li key={href}>
                  <Link href={href} aria-current={isActive(path, href) ? 'page' : undefined}
                    className={`flex h-full flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-center text-xs font-medium ${isActive(path, href) ? 'border-emerald-500/50 bg-emerald-500/10 text-zinc-100' : 'border-zinc-800 text-zinc-300 hover:bg-zinc-800'}`}>
                    <Icon size={22} aria-hidden />{label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-3 border-t border-zinc-800 pt-4">
              <ThemeToggle />
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-xs text-zinc-500">{email}</span>
                <button onClick={signOut} className="btn-ghost shrink-0"><LogOut size={16} aria-hidden /> Sair</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
