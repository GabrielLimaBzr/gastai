-- GastAI: schema inicial. Todas as tabelas isoladas por usuário via RLS.
create extension if not exists pgcrypto;

create type account_kind as enum ('card', 'checking', 'cash');
create type tx_source as enum ('pdf', 'notion', 'manual', 'recurring');

create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind account_kind not null,
  closing_day smallint check (closing_day between 1 and 31),
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  unique (user_id, name)
);

-- Regras merchant -> categoria para categorizar automaticamente ao importar
create table merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern text not null,            -- substring em maiúsculas
  category_id uuid not null references categories on delete cascade
);

-- Cada PDF de fatura importado (evita importar duas vezes)
create table statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references accounts on delete cascade,
  reference_month date not null,    -- sempre dia 1 do mês da fatura
  total_cents bigint,
  file_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid references accounts on delete set null,
  statement_id uuid references statements on delete cascade,
  category_id uuid references categories on delete set null,
  occurred_on date not null,
  description text not null,
  amount_cents bigint not null,     -- positivo = gasto, negativo = estorno
  installment_no smallint,
  installment_total smallint,
  source tx_source not null default 'manual',
  dedupe_key text not null,         -- hash(data|descrição|valor|parcela) p/ importação idempotente
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index on transactions (user_id, occurred_on);

-- Contas fixas (aluguel, internet, assinaturas...)
create table recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  category_id uuid references categories on delete set null,
  expected_cents bigint not null,
  due_day smallint not null check (due_day between 1 and 31),
  active boolean not null default true
);

-- Renda mensal (várias fontes)
create table income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null,
  month date not null,              -- dia 1 do mês
  amount_cents bigint not null,
  unique (user_id, source, month)
);

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','merchant_rules','statements','transactions','recurring_bills','income']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
