-- Pagamentos marcados no calendário: uma linha por vencimento pago (fatura de cartão ou conta fixa) em cada mês.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('card', 'bill')),
  ref_id uuid not null,                 -- id do cartão (kind = card) ou da conta fixa (kind = bill)
  month date not null,                  -- dia 1 do mês do vencimento
  paid_on date not null,                -- quando você pagou
  amount_cents bigint,                  -- valor pago (guardado no momento da marcação)
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id, month)
);
alter table public.payments enable row level security;
create policy "own rows" on public.payments for all using (user_id = auth.uid()) with check (user_id = auth.uid());
