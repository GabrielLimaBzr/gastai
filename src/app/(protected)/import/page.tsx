'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dedupeKey } from '@/lib/dedupe'
import { parseNotionCsv } from '@/lib/notionCsv'
import { isNubankCsv, parseNubankCsv } from '@/lib/nubankCsv'
import { extractPages } from '@/lib/pdf/extract'
import { parseInvoice } from '@/lib/pdf'
import { sha256Hex } from '@/lib/pdfInvoice'
import { brl } from '@/lib/money'
import { useCategories } from '@/hooks/useCategories'
import type { Tx } from '@/lib/types'

interface Account { id: string; name: string }
type Preview = {
  txs: Tx[]; source: 'pdf' | 'notion'; fileHash?: string
  bank?: string; billedMonth?: string; declaredTotal?: number | null
}

/** Nubank: o CSV traz as compras do ciclo; a fatura vence no mês seguinte à última compra. */
function nextMonth(ym?: string) {
  if (!ym) return undefined
  const [y, m] = ym.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}

export default function Import() {
  const supabase = createClient()
  const { ruleFor } = useCategories()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [newAccount, setNewAccount] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [msg, setMsg] = useState('')

  async function loadAccounts() {
    const { data } = await supabase.from('accounts').select('id,name').order('name')
    setAccounts((data as Account[]) ?? [])
    if (data?.length && !accountId) setAccountId(data[0].id)
  }
  useEffect(() => { loadAccounts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addAccount() {
    if (!newAccount) return
    await supabase.from('accounts').insert({ name: newAccount, kind: 'card' })
    setNewAccount(''); loadAccounts()
  }

  async function onFile(f: File) {
    setMsg('')
    if (f.name.toLowerCase().endsWith('.pdf')) {
      const buf = await f.arrayBuffer()
      const parsed = parseInvoice(await extractPages(buf), year)
      setPreview({
        txs: parsed.txs, source: 'pdf', fileHash: await sha256Hex(buf), bank: parsed.bank,
        billedMonth: parsed.dueDate?.slice(0, 7), declaredTotal: parsed.statementTotalCents,
      })
      if (!parsed.txs.length) setMsg('Nenhum lançamento reconhecido. O layout deste banco precisa de um parser dedicado.')
    } else {
      const text = await f.text()
      setPreview(isNubankCsv(text)
        ? { txs: parseNubankCsv(text), source: 'pdf', fileHash: await sha256Hex(new TextEncoder().encode(text).buffer as ArrayBuffer), bank: 'nubank', billedMonth: nextMonth(text.match(/\d{4}-\d{2}/)?.[0]) }
        : { txs: parseNotionCsv(text), source: 'notion' })
    }
  }

  async function save() {
    if (!preview) return
    let statementId: string | null = null
    if (preview.source === 'pdf') {
      if (!accountId) return setMsg('Crie/selecione o cartão primeiro.')
      if (!preview.billedMonth) return setMsg('Informe o mês da fatura.')
      const { data, error } = await supabase.from('statements').insert({
        account_id: accountId, reference_month: `${preview.billedMonth}-01`, file_hash: preview.fileHash,
        total_cents: preview.txs.reduce((s, t) => s + t.amount_cents, 0),
      }).select('id').single()
      if (error) return setMsg(error.code === '23505' ? 'Esta fatura já foi importada.' : error.message)
      statementId = data.id
    }
    const seen = new Map<string, number>()
    const rows = []
    for (const t of preview.txs) {
      const base = `${t.occurred_on}|${t.description}|${t.amount_cents}|${t.installment_no ?? ''}`
      const n = seen.get(base) ?? 0
      seen.set(base, n + 1)
      rows.push({
        occurred_on: t.occurred_on, description: t.description, amount_cents: t.amount_cents,
        installment_no: t.installment_no ?? null, installment_total: t.installment_total ?? null,
        billed_month: preview.billedMonth ? `${preview.billedMonth}-01` : null,
        category_id: ruleFor(t.description),
        account_id: preview.source === 'pdf' ? accountId : null, statement_id: statementId,
        source: preview.source, dedupe_key: await dedupeKey(t, n),
      })
    }
    const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
    setMsg(error ? error.message : `${rows.length} lançamentos processados.`)
    if (!error) setPreview(null)
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-medium">Cartões</h2>
        <div className="flex flex-wrap gap-2">
          <select className="input min-w-0 flex-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input className="input min-w-0 flex-1" placeholder="Novo cartão" value={newAccount} onChange={(e) => setNewAccount(e.target.value)} />
          <button className="btn" onClick={addAccount}>Criar</button>
        </div>
      </div>
      <div className="card space-y-3">
        <h2 className="font-medium">Arquivo (PDF da fatura ou CSV do Notion)</h2>
        <label className="flex items-center gap-2 text-sm text-zinc-400">Ano da fatura
          <input className="input w-24" type="number" value={year} onChange={(e) => setYear(+e.target.value)} />
        </label>
        <input type="file" accept=".pdf,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
      {preview && preview.txs.length > 0 && (
        <div className="card space-y-3">
          <PreviewHeader p={preview} onMonth={(m) => setPreview({ ...preview, billedMonth: m })} />
          <div className="max-h-64 divide-y divide-zinc-800 overflow-auto text-sm">
            {preview.txs.map((t, i) => (
              <div key={i} className="flex justify-between gap-3 py-1"><span className="min-w-0 truncate">{t.occurred_on.slice(5)} {t.description}</span><span className="shrink-0 tabular-nums">{brl(t.amount_cents)}</span></div>
            ))}
          </div>
          <button className="btn" onClick={save}>Salvar</button>
        </div>
      )}
    </div>
  )
}

function PreviewHeader({ p, onMonth }: { p: Preview; onMonth: (m: string) => void }) {
  const sum = p.txs.reduce((s, t) => s + t.amount_cents, 0)
  const ok = p.declaredTotal != null && p.declaredTotal === sum
  return (
    <div className="space-y-1 text-sm">
      <p>{p.bank && <span className="mr-2 rounded bg-zinc-800 px-2 py-0.5 text-xs uppercase">{p.bank}</span>}
        {p.txs.length} lançamentos · {brl(sum)}</p>
      {p.declaredTotal != null && (
        <p className={ok ? 'text-emerald-400' : 'text-amber-300'}>
          {ok ? '✓ Soma confere com o total da fatura' : `⚠ Fatura declara ${brl(p.declaredTotal)} (diferença ${brl(sum - p.declaredTotal)}) — confira antes de salvar`}
        </p>
      )}
      {p.source === 'pdf' && (
        <label className="flex items-center gap-2 text-zinc-400">Mês da fatura
          <input type="month" className="input w-auto" value={p.billedMonth ?? ''} onChange={(e) => onMonth(e.target.value)} />
        </label>
      )}
    </div>
  )
}
