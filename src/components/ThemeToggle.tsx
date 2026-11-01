'use client'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemePref } from '@/contexts/theme'

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Auto', Icon: Monitor },
]

/** Escolha do tema: claro, escuro ou automático (segue o aparelho). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { pref, setPref } = useTheme()
  return (
    <div className={`seg w-full ${className}`} role="group" aria-label="Aparência">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button key={value} type="button" aria-pressed={pref === value} onClick={() => setPref(value)} title={value === 'system' ? 'Automático: segue o tema do aparelho' : label} aria-label={value === 'system' ? 'Automático, segue o tema do aparelho' : label} className="flex min-w-0 flex-1 items-center justify-center gap-1 px-1.5 text-xs sm:text-sm">
          <Icon size={15} aria-hidden /> <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
