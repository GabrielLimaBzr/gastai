import Link from 'next/link'
import { ArrowRight, FileUp, ListChecks, PieChart } from 'lucide-react'
import { QuickStart } from '@/components/QuickStart'

const STEPS = [
  { Icon: FileUp, title: 'Importe uma fatura', text: 'PDF do cartão ou CSV do Nubank. Leva alguns segundos.' },
  { Icon: ListChecks, title: 'Confira as categorias', text: 'O app sugere; você ajusta o que quiser.' },
  { Icon: PieChart, title: 'Veja para onde vai o dinheiro', text: 'Gráficos, metas e o calendário do que vence.' },
]

/** Tela inicial de quem ainda não importou nada: explica o caminho em 3 passos e leva ao primeiro. */
export function Welcome() {
  return (
    <div className="space-y-4">
      <section className="card space-y-4 text-center">
        <div>
          <h1 className="text-xl font-semibold">Bem-vindo ao GastAI</h1>
          <p className="mt-1 text-sm text-zinc-400">Veja para onde vai o seu dinheiro em poucos minutos. Comece pela fatura do cartão:</p>
        </div>
        <ol className="grid gap-3 text-left sm:grid-cols-3">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="flex items-start gap-3 rounded-lg border border-zinc-800 p-3 sm:flex-col">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400"><Icon size={18} aria-hidden /></span>
              <span><span className="block text-sm font-medium">{i + 1}. {title}</span><span className="text-xs text-zinc-400">{text}</span></span>
            </li>
          ))}
        </ol>
        <Link href="/import" className="btn w-full py-2.5 text-base sm:w-auto">Importar a minha primeira fatura <ArrowRight size={18} aria-hidden /></Link>
      </section>
      <QuickStart force listOnly />
    </div>
  )
}
