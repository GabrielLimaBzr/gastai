'use client'
import { useEffect, useState } from 'react'
import { detectLocale, type Locale } from '@/lib/i18n'

/** Idioma do aparelho/navegador. Começa em português (igual ao servidor) e ajusta após montar, sem erro de hidratação. */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>('pt')
  useEffect(() => { setLocale(detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language])) }, [])
  return locale
}
