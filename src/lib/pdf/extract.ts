import type { PdfPage } from './types'

/** Lê o PDF no navegador e devolve cada texto com sua posição (x, y). */
export async function extractPages(data: ArrayBuffer): Promise<PdfPage[]> {
  // import dinâmico: pdfjs depende de APIs do navegador e não pode rodar no build/SSR
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data }).promise
  const pages: PdfPage[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent()
    pages.push({
      items: (content.items as any[])
        .filter((i) => typeof i.str === 'string' && i.str.trim())
        .map((i) => ({ x: Math.round(i.transform[4]), y: Math.round(i.transform[5]), str: i.str as string })),
    })
  }
  return pages
}
