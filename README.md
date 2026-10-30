# GastAI

Gestão de gastos pessoal: histórico contínuo, faturas de cartão em PDF, contas fixas, anomalias e comparação com a renda mensal.

**Stack (custo zero):** Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth, RLS) · deploy na Vercel (free). O PDF é lido no navegador (pdfjs), sem servidor de processamento. Mesmo padrão de Supabase do `emprestai` (`@supabase/ssr`, `proxy.ts` de auth, grupo `(protected)`).

## Rodar

```bash
cp .env.example .env.local   # preencha URL e anon key do Supabase
npm install
npm run dev
npm test
```

Banco: rode `supabase/migrations/0001_init.sql` no SQL Editor. Se reutilizar o projeto Supabase do `emprestai`, não há conflito de nomes (tabelas em inglês aqui, `tomadores`/`emprestimos`/... lá), e o RLS isola por `user_id`.

## Estrutura

- `src/lib/anomalies.ts` — duplicatas, picos, estabelecimento novo alto, mudança de preço em assinatura
- `src/lib/pdfInvoice.ts` — leitura de PDF e parser de fatura (genérico; um parser por banco em `PARSERS`)
- `src/lib/notionCsv.ts` — importa o CSV exportado do Notion
- `src/lib/dedupe.ts` — chave idempotente: reimportar não duplica
- `src/app/(protected)/` — Resumo (renda vs gastos), Transações, Contas fixas, Importar, Anomalias

## Próximos passos

- Parser dedicado do banco do cartão (precisa de uma fatura real)
- Categorização automática via `merchant_rules`
- Testes E2E com Playwright
