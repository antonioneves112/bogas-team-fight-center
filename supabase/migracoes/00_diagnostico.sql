-- =========================================================================
-- 00_DIAGNOSTICO.SQL  (só leitura, não altera nada)
-- Corre no SQL Editor do Supabase ANTES das migrações para ver o estado atual.
-- =========================================================================

-- 1. Políticas RLS existentes
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 2. Tabelas e se têm RLS ligado
select c.relname as tabela, c.relrowsecurity as rls_ligado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 3. Funções antigas chamadas pelo portal
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('assinar_regulamento', 'alterar_password_atleta');

-- 4. Contas de login (devem ser SÓ treinadores)
select id, email, created_at, last_sign_in_at from auth.users order by created_at;
