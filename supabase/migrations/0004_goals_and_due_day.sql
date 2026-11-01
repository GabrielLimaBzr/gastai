-- Meta mensal por categoria (em centavos; vazio = sem meta) e dia de vencimento da fatura de cada cartão.
alter table public.categories add column goal_cents bigint check (goal_cents > 0);
alter table public.accounts add column due_day smallint check (due_day between 1 and 31);
