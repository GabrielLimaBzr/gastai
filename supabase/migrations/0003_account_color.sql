-- Cor escolhida pelo usuário para o cartão (opcional; vazio = cor padrão do banco). Só aceita #RRGGBB.
alter table public.accounts add column color text check (color ~ '^#[0-9a-fA-F]{6}$');
