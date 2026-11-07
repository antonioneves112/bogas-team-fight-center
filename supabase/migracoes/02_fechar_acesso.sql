-- =========================================================================
-- 02_FECHAR_ACESSO.SQL — FASE 2 (correr SÓ depois de o site novo estar publicado)
-- Fecha a base de dados ao público:
--   * visitantes sem login (anon) deixam de ler/escrever tabelas;
--   * só treinadores (tabela public.treinadores) gerem os dados;
--   * atletas só acedem aos SEUS dados através das funções portal_*.
-- Idempotente: pode correr-se mais do que uma vez.
-- =========================================================================

-- 1. Passwords: qualquer password ainda em texto (ex.: alterada no site antigo
--    entre a fase 1 e a fase 2) passa a hash, e o texto é apagado.
update public.socios
set password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
where password is not null and password <> ''
  and (password_hash is null or extensions.crypt(password, password_hash) <> password_hash);

update public.socios set password = null where password is not null;

-- 2. RLS em TODAS as tabelas do schema public, sem exceção.
--    Apaga as políticas antigas (algumas davam acesso ao público) e cria uma única
--    política: treinador pode tudo.
do $$
declare
  t record;
  p record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);

    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t.relname loop
      execute format('drop policy %I on public.%I', p.policyname, t.relname);
    end loop;

    execute format('revoke all on public.%I from anon', t.relname);

    if t.relname not in ('sessoes_atleta', 'login_tentativas') then
      execute format(
        'create policy treinador_total on public.%I for all to authenticated
           using (public.is_treinador()) with check (public.is_treinador())',
        t.relname);
    end if;
  end loop;
end;
$$;

-- 3. Exceção pública: o "ping" que mantém o projeto acordado (index.html).
grant select on public.sistema_ping to anon;
create policy ping_publico on public.sistema_ping for select to anon using (true);

-- 4. Funções antigas que aceitavam qualquer ID de atleta: deixam de ser públicas.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('assinar_regulamento', 'alterar_password_atleta')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end;
$$;

-- 5. Tabelas criadas no futuro também ficam fechadas por defeito ao público.
alter default privileges in schema public revoke all on tables from anon;

-- =========================================================================
-- VERIFICAÇÃO (deve devolver 0 linhas: nenhuma tabela pública sem RLS)
-- =========================================================================
select c.relname as tabela_sem_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
