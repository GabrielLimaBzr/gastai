import { QuickStart } from '@/components/QuickStart'

const TIPS: { title: string; text: string }[] = [
  { title: 'Cada fatura conta no mês em que vence', text: 'Compras de setembro numa fatura que vence em outubro ficam em outubro. Assim o gráfico mostra o que você realmente pagou em cada mês.' },
  { title: 'Categorize uma vez, vale para sempre', text: 'Ao escolher a categoria de uma compra, o app oferece aplicar a todas do mesmo lugar e lembra da escolha nas próximas faturas. Use "Por estabelecimento" em Transações para resolver várias de uma vez.' },
  { title: 'Parcelas já contratadas', text: 'A tela Parcelas mostra, mês a mês, o que ainda vai cair das compras parceladas, em qual cartão, e quando cada parcelamento termina.' },
  { title: 'Calendário com check de pago', text: 'Toque no círculo ao pagar uma fatura ou conta. O "A pagar" diminui e o Resumo avisa o que está atrasado ou vence em até 7 dias.' },
  { title: 'Contas que mudam todo mês', text: 'Luz e água entram como "variáveis": o app usa uma estimativa até você informar o valor real no Calendário.' },
  { title: 'Seus arquivos ficam com você', text: 'O PDF da fatura é lido no seu aparelho e não é enviado: só os lançamentos entram no seu cadastro. Você pode exportar tudo em CSV na tela Transações.' },
]

export default function StartPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Primeiros passos</h1>
      <p className="text-sm text-zinc-400">Um roteiro para configurar o app no seu ritmo. Os passos se marcam sozinhos conforme você usa, e você pode pular qualquer um.</p>
      <QuickStart page />
      <section className="card">
        <h2 className="font-medium">Dicas rápidas</h2>
        <dl className="mt-3 space-y-4">
          {TIPS.map((t) => (
            <div key={t.title}>
              <dt className="text-sm font-medium">{t.title}</dt>
              <dd className="mt-0.5 text-sm text-zinc-400">{t.text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
