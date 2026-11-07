-- =========================================================================
-- 99_EMERGENCIA_REVERTER_FASE2.SQL — usar SÓ se algo correr mal depois da fase 2.
-- Volta a abrir as tabelas principais como estavam (inseguro!), para dar tempo a corrigir.
-- As passwords continuam em hash: o site NOVO continua a funcionar; o site ANTIGO
-- passa a aceitar o telemóvel como password (era a regra antiga sem password).
-- =========================================================================
do $$
declare
  t text;
begin
  foreach t in array array['socios', 'mensalidades', 'aulas_particulares', 'notificacoes',
                           'push_subscriptions', 'admin_push_subscriptions', 'despesas']
  loop
    execute format('alter table public.%I disable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon', t);
  end loop;
end;
$$;
