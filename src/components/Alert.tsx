import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'

const LOOK = {
  error: { box: 'border-red-500/40 bg-red-500/10 text-red-200', Icon: AlertCircle, role: 'alert' as const },
  warning: { box: 'border-amber-500/40 bg-amber-500/10 text-amber-200', Icon: TriangleAlert, role: 'alert' as const },
  success: { box: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', Icon: CheckCircle2, role: 'status' as const },
  info: { box: 'border-sky-500/30 bg-sky-500/10 text-sky-200', Icon: Info, role: 'status' as const },
}

/** Aviso com ícone + texto (nunca só a cor). Erros são anunciados por leitores de tela. */
export function Alert({ kind = 'error', children, action }: { kind?: keyof typeof LOOK; children: React.ReactNode; action?: React.ReactNode }) {
  const { box, Icon, role } = LOOK[kind]
  return (
    <div role={role} className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${box}`}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>{children}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  )
}
