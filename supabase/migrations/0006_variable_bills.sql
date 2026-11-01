-- Conta variável (luz, água...): tem vencimento fixo, mas o valor muda a cada mês.
alter table public.recurring_bills add column variable boolean not null default false;

-- Valor real de uma conta variável em cada mês (quando a conta chega).
create table public.bill_amounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  bill_id uuid not null references public.recurring_bills on delete cascade,
  month date not null,                              -- dia 1 do mês do vencimento
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (user_id, bill_id, month)
);
alter table public.bill_amounts enable row level security;
create policy "own rows" on public.bill_amounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
