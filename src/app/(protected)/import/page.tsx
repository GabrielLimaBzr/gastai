'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dedupeKey } from '@/lib/dedupe'
import { BANK_LABEL, accountMatchesBank, isKnownBank, matchAccount, nubankBilledMonth } from '@/lib/bank'
import { parseNotionCsv } from '@/lib/notionCsv'
import { isNubankCsv, parseNubankCsv } from '@/lib/nubankCsv'
import { extractPages } from '@/lib/pdf/extract'
import { parseInvoice } from '@/lib/pdf'
import { sha256Hex } from '@/lib/pdfInvoice'
import { brl } from '@/lib/money'
import { useCategories } from '@/hooks/useCategories'
import { Dropzone } from '@/components/Dropzone'
import { CardColors } from '@/components/CardColors'
import { ImportedStatements } from '@/components/ImportedStatements'
import type { Tx } from '@/lib/types'

interface Account { id: string; name: string; color: string | null }
type Preview = {
  txs: Tx[]; source: 'pdf' | 'notion'; fileHash?: string
  bank?: string; billedMonth?: string; declaredTotal?: number | null
}

const CREATE = '__create__' // "criar o cartão do banco detectado ao salvar"

export default function Import() {
  const supabase = createClient()
  const { ruleFor } = useCategories()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [newAccount, setNewAccount] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [preview, setPreview] = useState<Preview | null>(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileKey, setFileKey] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  async function loadAccounts(): Promise<Account[]> {
    const { data } = await supabase.from('accounts').select('id,name,color').order('created_at')
    const list = (data as Account[]) ?? []
    setAccounts(list)
    return list
  }
  useEffect(() => { loadAccounts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function addAccount() {
    if (!newAccount.trim()) return
    await supabase.from('accounts').insert({ name: newAccount.trim(), kind: 'card' })
    setNewAccount(''); loadAccounts()
  }

  /** O cartão vem do banco detectado no arquivo. Sem cartão padrão: arquivo desconhecido exige escolha. */
  async function pickAccount(bank?: string) {
    if (!isKnownBank(bank)) return setAccountId('')
    const list = accounts.length ? accounts : await loadAccounts()
    setAccountId(matchAccount(list, bank)?.id ?? CREATE)
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
      await pickAccount(parsed.bank)
      if (!parsed.txs.length) setMsg('Nenhum lançamento reconhecido. O layout deste banco precisa de um parser dedicado.')
    } else {
      const text = await f.text()
      if (isNubankCsv(text)) {
        const txs = parseNubankCsv(text)
        setPreview({ txs, source: 'pdf', fileHash: await sha256Hex(new TextEncoder().encode(text).buffer as ArrayBuffer), bank: 'nubank', billedMonth: nubankBilledMonth(f.name, txs) })
        await pickAccount('nubank')
      } else {
        setPreview({ txs: parseNotionCsv(text), source: 'notion' })
      }
    }
  }

  async function save() {
    if (!preview || saving) return
    setSaving(true); setMsg('')
    let statementId: string | null = null
    try {
      let accId: string | null = null
      let accName = ''
      if (preview.source === 'pdf') {
        if (!accountId) return setMsg('Escolha o cartão desta fatura.')
        if (!preview.billedMonth) return setMsg('Informe o mês da fatura.')
        if (accountId === CREATE) {
          accName = BANK_LABEL[preview.bank as keyof typeof BANK_LABEL]
          const { data, error } = await supabase.from('accounts').insert({ name: accName, kind: 'card' }).select('id').single()
          if (error) return setMsg(`Não consegui criar o cartão ${accName}: ${error.message}`)
          accId = data.id
        } else {
          const chosen = accounts.find((a) => a.id === accountId)!
          accName = chosen.name
          if (isKnownBank(preview.bank) && !accountMatchesBank(chosen.name, preview.bank)
            && !confirm(`Esta fatura parece ser do ${BANK_LABEL[preview.bank]}, mas o cartão escolhido é «${chosen.name}». Salvar mesmo assim?`)) return
          accId = chosen.id
        }
        const { data, error } = await supabase.from('statements').insert({
          account_id: accId, reference_month: `${preview.billedMonth}-01`, file_hash: preview.fileHash,
          total_cents: preview.txs.reduce((s, t) => s + t.amount_cents, 0),
        }).select('id').single()
        if (error) return setMsg(error.code === '23505' ? 'Esta fatura já foi importada (veja em "Faturas importadas").' : error.message)
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
          account_id: accId, statement_id: statementId,
          source: preview.source, dedupe_key: await dedupeKey(t, n),
        })
      }
      const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
      if (error) {
        // não deixa uma fatura "vazia" travando a reimportação do mesmo arquivo
        if (statementId) await supabase.from('statements').delete().eq('id', statementId)
        return setMsg(`Não salvou: ${error.message}`)
      }
      setMsg(`${rows.length} lançamentos processados${accName ? ` em «${accName}»` : ''}.`)
      setPreview(null); setAccountId(''); setFileKey((k) => k + 1); setReloadKey((k) => k + 1)
      await loadAccounts()
    } finally {
      setSaving(false)
    }
  }

  const bankName = preview && isKnownBank(preview.bank) ? BANK_LABEL[preview.bank] : null

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <h2 className="font-medium">Importar fatura</h2>
        <p className="text-xs text-zinc-500">O banco é reconhecido pelo arquivo e o cartão certo é escolhido sozinho. Você confere antes de salvar.</p>
        <Dropzone key={fileKey} onFile={onFile} />
        <label className="flex items-center gap-2 text-xs text-zinc-500">Ano da fatura (só para PDFs sem ano)
          <input className="input w-24 py-1" type="number" value={year} onChange={(e) => setYear(+e.target.value)} />
        </label>
      </div>
      {msg && <p className="text-sm text-amber-300" role="status">{msg}</p>}
      {preview && preview.txs.length > 0 && (
        <div className="card space-y-3">
          <PreviewHeader p={preview} onMonth={(m) => setPreview({ ...preview, billedMonth: m })} />
          {preview.source === 'pdf' && (
            <label className="block text-sm text-zinc-400">Cartão desta fatura
              <select className={`input mt-1 ${!accountId ? 'border-amber-500/60' : ''}`} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {!accountId && <option value="" disabled>Escolher cartão…</option>}
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                {bankName && !matchAccount(accounts, preview.bank) && <option value={CREATE}>＋ Criar cartão «{bankName}»</option>}
              </select>
              {bankName && accountId && accountId !== CREATE && !accountMatchesBank(accounts.find((a) => a.id === accountId)?.name ?? '', preview.bank) && (
                <span className="mt-1 block text-xs text-amber-300">⚠ Esta fatura parece ser do {bankName}, mas esse cartão não tem esse nome.</span>
              )}
            </label>
          )}
          <div className="max-h-64 divide-y divide-zinc-800 overflow-auto text-sm">
            {preview.txs.map((t, i) => (
              <div key={i} className="flex justify-between gap-3 py-1"><span className="min-w-0 truncate">{t.occurred_on.slice(8, 10)}/{t.occurred_on.slice(5, 7)} {t.description}</span><span className="shrink-0 tabular-nums">{brl(t.amount_cents)}</span></div>
            ))}
          </div>
          <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      )}

      <ImportedStatements accounts={accounts} reloadKey={reloadKey} onChanged={() => loadAccounts()} />

      <div className="card space-y-2">
        <h2 className="font-medium">Cartões</h2>
        {accounts.length
          ? <CardColors accounts={accounts} onChanged={() => loadAccounts()} />
          : <p className="text-xs text-zinc-500">Nenhum cartão ainda — ele é criado sozinho na primeira importação.</p>}
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-0 flex-1" placeholder="Novo cartão" value={newAccount} onChange={(e) => setNewAccount(e.target.value)} />
          <button className="btn" onClick={addAccount}>Criar</button>
        </div>
      </div>
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
