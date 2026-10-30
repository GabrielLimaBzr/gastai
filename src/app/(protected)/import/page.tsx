'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dedupeKey } from '@/lib/dedupe'
import { parseNotionCsv } from '@/lib/notionCsv'
import { isNubankCsv, parseNubankCsv } from '@/lib/nubankCsv'
import { parseGenericInvoice, pdfToLines, sha256Hex } from '@/lib/pdfInvoice'
import { brl } from '@/lib/money'
import type { Tx } from '@/lib/types'

interface Account { id: string; name: string }
type Preview = { txs: Tx[]; source: 'pdf' | 'notion'; fileHash?: string; refMonth?: string }

export default function Import() {
  const supabase = createClient()
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
      const txs = parseGenericInvoice(await pdfToLines(buf), year)
      setPreview({ txs, source: 'pdf', fileHash: await sha256Hex(buf), refMonth: txs[0]?.occurred_on.slice(0, 7) })
      if (!txs.length) setMsg('Nenhum lançamento reconhecido. O layout deste banco precisa de um parser dedicado.')
    } else {
      const text = await f.text()
      setPreview(isNubankCsv(text)
        ? { txs: parseNubankCsv(text), source: 'pdf', fileHash: await sha256Hex(new TextEncoder().encode(text).buffer as ArrayBuffer), refMonth: text.match(/\d{4}-\d{2}/)?.[0] }
        : { txs: parseNotionCsv(text), source: 'notion' })
    }
  }

  async function save() {
    if (!preview) return
    let statementId: string | null = null
    if (preview.source === 'pdf') {
      if (!accountId) return setMsg('Crie/selecione o cartão primeiro.')
      const { data, error } = await supabase.from('statements').insert({
        account_id: accountId, reference_month: `${preview.refMonth}-01`, file_hash: preview.fileHash,
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
        <div className="flex gap-2">
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input className="input" placeholder="Novo cartão" value={newAccount} onChange={(e) => setNewAccount(e.target.value)} />
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
          <p className="text-sm">{preview.txs.length} lançamentos · {brl(preview.txs.reduce((s, t) => s + t.amount_cents, 0))}</p>
          <div className="max-h-64 divide-y divide-zinc-800 overflow-auto text-sm">
            {preview.txs.map((t, i) => (
              <div key={i} className="flex justify-between py-1"><span>{t.occurred_on} {t.description}</span><span>{brl(t.amount_cents)}</span></div>
            ))}
          </div>
          <button className="btn" onClick={save}>Salvar</button>
        </div>
      )}
    </div>
  )
}
