-- Total parcial da fatura em aberto de cada cartão (o usuário informa; faturas parciais não dá para exportar).
create table public.card_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references public.accounts on delete cascade,
  month date not null,                              -- dia 1 do mês de vencimento da fatura
  amount_cents bigint not null check (amount_cents >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, account_id, month)
);
alter table public.card_estimates enable row level security;
create policy "own rows" on public.card_estimates for all using (user_id = auth.uid()) with check (user_id = auth.uid());
