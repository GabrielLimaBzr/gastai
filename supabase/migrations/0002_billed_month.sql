-- Mês de competência: parcelas e compras entram no mês da fatura em que foram cobradas.
alter table transactions add column billed_month date;
update transactions set billed_month = date_trunc('month', occurred_on)::date where billed_month is null;
create index on transactions (user_id, billed_month);
