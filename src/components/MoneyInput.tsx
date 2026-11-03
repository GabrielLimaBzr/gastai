'use client'
import { maskDay, maskMoney } from '@/lib/mask'

type Base = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>

/** Campo de dinheiro com máscara (R$ 1.234,56). O valor guardado é o texto mascarado; use `toCents` para converter. */
export function MoneyInput({ value, onValueChange, className = '', ...rest }: Base & { value: string; onValueChange: (v: string) => void }) {
  return (
    <span className="relative block">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500" aria-hidden>R$</span>
      <input {...rest} type="text" inputMode="numeric" autoComplete="off" placeholder={rest.placeholder ?? '0,00'}
        className={`input w-full pl-9 tabular-nums ${className}`} value={value} onChange={(e) => onValueChange(maskMoney(e.target.value))} />
    </span>
  )
}

/** Campo do dia do vencimento (1 a 31) com máscara. */
export function DayInput({ value, onValueChange, className = '', ...rest }: Base & { value: string; onValueChange: (v: string) => void }) {
  return (
    <input {...rest} type="text" inputMode="numeric" autoComplete="off" maxLength={2} placeholder={rest.placeholder ?? 'dia'}
      className={`input tabular-nums ${className}`} value={value} onChange={(e) => onValueChange(maskDay(e.target.value))} />
  )
}
