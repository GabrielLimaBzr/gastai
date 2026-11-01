export type Locale = 'pt' | 'en' | 'es'

/** Primeiro idioma preferido do aparelho que o app conhece; qualquer outro cai no português (idioma do app). */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  for (const l of languages ?? []) {
    const code = l.toLowerCase().slice(0, 2)
    if (code === 'pt' || code === 'en' || code === 'es') return code
  }
  return 'pt'
}

export interface UploadText {
  title: string
  drag: string
  hint: string
  reading: string
  change: string
  remove: string
  unsupported: string
}

export const UPLOAD_TEXT: Record<Locale, UploadText> = {
  pt: { title: 'Escolher arquivo', drag: 'ou arraste e solte aqui', hint: 'PDF da fatura, CSV do Nubank ou CSV do Notion', reading: 'Lendo o arquivo…', change: 'Trocar', remove: 'Remover', unsupported: 'Formato não suportado. Envie um PDF ou CSV.' },
  en: { title: 'Choose a file', drag: 'or drag and drop it here', hint: 'Card statement PDF, Nubank CSV or Notion CSV', reading: 'Reading the file…', change: 'Change', remove: 'Remove', unsupported: 'Unsupported format. Please upload a PDF or CSV.' },
  es: { title: 'Elegir archivo', drag: 'o arrástralo y suéltalo aquí', hint: 'PDF del extracto, CSV de Nubank o CSV de Notion', reading: 'Leyendo el archivo…', change: 'Cambiar', remove: 'Quitar', unsupported: 'Formato no compatible. Sube un PDF o CSV.' },
}

export function formatBytes(bytes: number, locale: Locale): string {
  const tag = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[locale]
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString(tag, { maximumFractionDigits: 0 })} KB`
  return `${(bytes / 1024 / 1024).toLocaleString(tag, { maximumFractionDigits: 1 })} MB`
}
