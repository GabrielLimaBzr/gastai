'use client'
import { useRef, useState } from 'react'
import { FileSpreadsheet, FileText, Loader2, UploadCloud, X } from 'lucide-react'
import { useLocale } from '@/hooks/useLocale'
import { UPLOAD_TEXT, formatBytes } from '@/lib/i18n'

const OK = /\.(pdf|csv)$/i

/** Campo de upload: toque/clique ou arraste. Os textos seguem o idioma do aparelho. */
export function Dropzone({ onFile }: { onFile: (f: File) => Promise<void> }) {
  const locale = useLocale()
  const t = UPLOAD_TEXT[locale]
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function take(f?: File | null) {
    if (!f) return
    if (!OK.test(f.name)) { setError(t.unsupported); return }
    setError(''); setFile(f); setBusy(true)
    try { await onFile(f) } finally { setBusy(false) }
  }
  function clear() {
    setFile(null); setError('')
    if (input.current) input.current.value = '' // permite escolher o mesmo arquivo de novo
  }

  const Icon = file && /\.pdf$/i.test(file.name) ? FileText : FileSpreadsheet

  return (
    <div>
      {/* o input nativo fica por baixo (acessível e testável); o visual é o do rótulo */}
      <input ref={input} id="invoice-file" type="file" accept=".pdf,.csv,application/pdf,text/csv" className="peer sr-only"
        onChange={(e) => take(e.target.files?.[0])} />
      {file ? (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
            {busy ? <Loader2 size={22} className="animate-spin" aria-hidden /> : <Icon size={22} aria-hidden />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-zinc-500">{busy ? t.reading : formatBytes(file.size, locale)}</span>
          </span>
          <label htmlFor="invoice-file" className="btn-ghost cursor-pointer">{t.change}</label>
          <button type="button" onClick={clear} className="grid size-9 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" aria-label={t.remove}>
            <X size={18} aria-hidden />
          </button>
        </div>
      ) : (
        <label
          htmlFor="invoice-file"
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files?.[0]) }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500
            ${over ? 'border-emerald-400 bg-emerald-500/10' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'}`}
        >
          <span className="grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-400"><UploadCloud size={26} aria-hidden /></span>
          <span className="text-base font-medium">{t.title}</span>
          <span className="hidden text-sm text-zinc-400 md:block">{t.drag}</span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <span className="chip">PDF</span><span className="chip">CSV</span>
          </span>
          <span className="text-xs text-zinc-500">{t.hint}</span>
        </label>
      )}
      {error && <p className="mt-2 text-sm text-amber-300" role="alert">{error}</p>}
    </div>
  )
}
