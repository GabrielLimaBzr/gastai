import { toCents } from './money'
import type { Tx } from './types'

/** Extrai linhas de texto de um PDF, agrupando itens pela posição vertical. Roda 100% no navegador. */
export async function pdfToLines(data: ArrayBuffer): Promise<string[]> {
  // import dinâmico: pdfjs depende de APIs do navegador e não pode rodar no build/SSR
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data }).promise
  const lines: string[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    const rows = new Map<number, { x: number; s: string }[]>()
    for (const it of content.items as any[]) {
      const y = Math.round(it.transform[5])
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }])
    }
    for (const y of [...rows.keys()].sort((a, b) => b - a))
      lines.push(rows.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim())
  }
  return lines
}

/**
 * Parser genérico: "DD/MM [descrição] [NN/NN] 1.234,56".
 * Cada banco tem layout próprio — ajuste/adicione parsers em PARSERS quando tivermos
 * uma fatura real para testar.
 */
export function parseGenericInvoice(lines: string[], year: number): Tx[] {
  const re = /^(\d{2})\/(\d{2})\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2})$/
  const out: Tx[] = []
  for (const line of lines) {
    const m = line.match(re)
    if (!m) continue
    let desc = m[3]
    let no: number | null = null
    let total: number | null = null
    const inst = desc.match(/\s(\d{2})\/(\d{2})$/)
    if (inst) {
      no = +inst[1]; total = +inst[2]
      desc = desc.slice(0, inst.index).trim()
    }
    out.push({
      occurred_on: `${year}-${m[2]}-${m[1]}`,
      description: desc,
      amount_cents: toCents(m[4]),
      installment_no: no,
      installment_total: total,
    })
  }
  return out
}

export const PARSERS = { generic: parseGenericInvoice } as const

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
