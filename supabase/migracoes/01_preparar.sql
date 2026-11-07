-- =========================================================================
-- 01_PREPARAR.SQL — FASE 1 (só acrescenta, não parte o site atual)
-- Pode correr-se com o site antigo ainda publicado: nada do que existe deixa
-- de funcionar. Cria as peças novas que o código novo vai usar.
-- Idempotente: pode correr-se mais do que uma vez.
-- =========================================================================

create extension if not exists pgcrypto with schema extensions;

-- -------------------------------------------------------------------------
-- 1. TREINADORES: quem pode gerir o clube (substitui o truque do email "antonio")
-- -------------------------------------------------------------------------
create table if not exists public.treinadores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nome text not null
);

-- Todas as contas de login atuais são de treinadores (os atletas não usam Supabase Auth).
-- Mesma regra que o login.js usava: email com "antonio" -> "António", senão "Bogas".
insert into public.treinadores (user_id, nome)
select u.id, case when u.email ilike '%antonio%' then 'António' else 'Bogas' end
from auth.users u
on conflict (user_id) do nothing;

alter table public.treinadores enable row level security;
revoke all on public.treinadores from anon;

create or replace function public.is_treinador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.treinadores t where t.user_id = auth.uid());
$$;

create or replace function public.meu_treinador()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.nome from public.treinadores t where t.user_id = auth.uid();
$$;

-- -------------------------------------------------------------------------
-- 2. PASSWORDS DOS ATLETAS: passam a ser guardadas com hash (bcrypt)
-- -------------------------------------------------------------------------
alter table public.socios add column if not exists password_hash text;

update public.socios
set password_hash = extensions.crypt(password, extensions.gen_salt('bf'))
where password is not null and password <> '' and password_hash is null;

-- -------------------------------------------------------------------------
-- 3. FATURA LIGADA À AULA (corrige a faturação de 2+ aulas no mesmo mês)
-- -------------------------------------------------------------------------
alter table public.mensalidades add column if not exists aula_id bigint;
create index if not exists mensalidades_aula_id_idx on public.mensalidades (aula_id);
create index if not exists mensalidades_mes_ano_idx on public.mensalidades (mes_ano);
create index if not exists mensalidades_socio_idx on public.mensalidades (socio_id);
create index if not exists aulas_socio_data_idx on public.aulas_particulares (socio_id, data_aula);
create index if not exists notificacoes_socio_idx on public.notificacoes (socio_id, created_at desc);

-- -------------------------------------------------------------------------
-- 4. SESSÕES DO PORTAL DO ATLETA (o browser guarda um token, nunca o ID)
-- -------------------------------------------------------------------------
create table if not exists public.sessoes_atleta (
  token_hash text primary key,
  socio_id bigint not null,
  criada_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '90 days'
);
create index if not exists sessoes_atleta_socio_idx on public.sessoes_atleta (socio_id);

create table if not exists public.login_tentativas (
  id bigint generated always as identity primary key,
  email text not null,
  criada_em timestamptz not null default now()
);
create index if not exists login_tentativas_email_idx on public.login_tentativas (email, criada_em);

-- Só as funções abaixo (security definer) mexem nestas tabelas.
alter table public.sessoes_atleta enable row level security;
alter table public.login_tentativas enable row level security;
revoke all on public.sessoes_atleta from anon, authenticated;
revoke all on public.login_tentativas from anon, authenticated;

-- Valida o token e devolve o ID do sócio (erro se a sessão não for válida).
create or replace function public._socio_da_sessao(p_token text)
returns bigint
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint;
begin
  if p_token is null or length(p_token) < 30 then
    raise exception 'SESSAO_INVALIDA';
  end if;
  select s.socio_id into v_socio
  from public.sessoes_atleta s
  where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and s.expira_em > now();
  if v_socio is null then
    raise exception 'SESSAO_INVALIDA';
  end if;
  return v_socio;
end;
$$;

-- Dados do sócio para o portal (nunca devolve password nem hash).
create or replace function public._socio_publico(p_socio bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(s) - 'password' - 'password_hash'
  from public.socios s
  where s.id = p_socio;
$$;

-- -------------------------------------------------------------------------
-- 5. API DO PORTAL (tudo o que o atleta pode fazer, e só sobre ele próprio)
-- -------------------------------------------------------------------------
create or replace function public.portal_login(p_email text, p_password text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_socio public.socios%rowtype;
  v_ok boolean := false;
  v_token text;
begin
  -- Proteção contra adivinhar passwords: máx. 8 falhas por email em 15 minutos.
  if (select count(*) from public.login_tentativas t
      where t.email = v_email and t.criada_em > now() - interval '15 minutes') >= 8 then
    raise exception 'DEMASIADAS_TENTATIVAS';
  end if;

  select * into v_socio from public.socios s
  where lower(trim(s.email)) = v_email
  order by s.id
  limit 1;

  if found then
    if v_socio.password_hash is not null then
      v_ok := extensions.crypt(p_password, v_socio.password_hash) = v_socio.password_hash;
    elsif v_socio.password is not null and v_socio.password <> '' then
      v_ok := p_password = v_socio.password;
    else
      -- Regra antiga mantida: sem password definida, a password é o telemóvel.
      v_ok := p_password = trim(v_socio.telemovel::text);
    end if;
  end if;

  if not v_ok then
    insert into public.login_tentativas (email) values (v_email);
    return null;
  end if;

  delete from public.login_tentativas where email = v_email;
  delete from public.sessoes_atleta where socio_id = v_socio.id and expira_em < now();

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.sessoes_atleta (token_hash, socio_id)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), v_socio.id);

  return jsonb_build_object('token', v_token, 'socio', public._socio_publico(v_socio.id));
end;
$$;

create or replace function public.portal_logout(p_token text)
returns void
language sql
volatile
security definer
set search_path = public, extensions
as $$
  delete from public.sessoes_atleta
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Tudo o que o ecrã inicial do portal precisa, num único pedido.
create or replace function public.portal_resumo(p_token text, p_mes text, p_hoje date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  return jsonb_build_object(
    'socio', public._socio_publico(v_socio),
    'faturas_mes', coalesce((
      select jsonb_agg(jsonb_build_object('estado', m.estado, 'tipo', m.tipo))
      from public.mensalidades m
      where m.socio_id = v_socio and m.mes_ano = p_mes), '[]'::jsonb),
    'tem_aula_por_pagar', exists (
      select 1 from public.aulas_particulares a
      where a.socio_id = v_socio and a.estado = 'Aceite' and a.pago = false),
    'proxima_aula', (
      select jsonb_build_object('data_aula', a.data_aula, 'hora_aula', a.hora_aula, 'estado', a.estado)
      from public.aulas_particulares a
      where a.socio_id = v_socio and a.data_aula::date >= p_hoje
      order by a.data_aula::date asc
      limit 1),
    'notificacoes', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at desc)
      from public.notificacoes n
      where n.socio_id = v_socio), '[]'::jsonb)
  );
end;
$$;

-- Nota: as funções validam SEMPRE o token primeiro (variável v_socio), mesmo que não haja linhas.
create or replace function public.portal_historico(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'mes_ano', m.mes_ano, 'tipo', m.tipo, 'valor', m.valor, 'estado', m.estado)
           order by m.mes_ano desc)
    from public.mensalidades m
    where m.socio_id = v_socio), '[]'::jsonb);
end;
$$;

create or replace function public.portal_marcar_lidas(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  update public.notificacoes set lida = true where socio_id = v_socio and lida = false;
end;
$$;

create or replace function public.portal_apagar_notificacao(p_token text, p_id bigint)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  delete from public.notificacoes where id = p_id and socio_id = v_socio;
  return found;
end;
$$;

create or replace function public.portal_pedir_aula(p_token text, p_data date, p_hora time, p_hoje date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
  v_dia int := extract(dow from p_data)::int;
  v_hora int := extract(hour from p_hora)::int;
  v_id bigint;
begin
  if p_data is null or p_hora is null then raise exception 'DADOS_EM_FALTA'; end if;
  if p_data < p_hoje - 1 then raise exception 'DATA_PASSADA'; end if;
  if v_dia between 1 and 5 then raise exception 'SO_FIM_DE_SEMANA'; end if;
  if (v_dia = 0 and v_hora < 10) or (v_dia = 6 and v_hora < 13) then
    raise exception 'FORA_DE_HORAS';
  end if;

  insert into public.aulas_particulares (socio_id, data_aula, hora_aula, estado)
  values (v_socio, p_data, p_hora, 'Pendente')
  returning id into v_id;

  insert into public.notificacoes (socio_id, titulo, mensagem, lida)
  values (v_socio, 'Aula Pendente ⏳', format('Pedido para dia %s enviado.', p_data), false);

  return jsonb_build_object('id', v_id, 'nome', (select nome from public.socios where id = v_socio));
end;
$$;

create or replace function public.portal_assinar_regulamento(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  update public.socios set regulamento_aceite = true where id = v_socio;
end;
$$;

create or replace function public.portal_alterar_password(p_token text, p_nova text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  if p_nova is null or length(trim(p_nova)) < 4 then
    raise exception 'PASSWORD_CURTA';
  end if;
  update public.socios
  set password_hash = extensions.crypt(trim(p_nova), extensions.gen_salt('bf')),
      password = null
  where id = v_socio;
  -- Termina as outras sessões abertas deste atleta (ex.: noutro telemóvel).
  delete from public.sessoes_atleta
  where socio_id = v_socio
    and token_hash <> encode(extensions.digest(p_token, 'sha256'), 'hex');
end;
$$;

create or replace function public.portal_tem_push(p_token text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
begin
  return exists (select 1 from public.push_subscriptions p where p.socio_id = v_socio);
end;
$$;

create or replace function public.portal_guardar_push(p_token text, p_subscricao text)
returns void
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  v_socio bigint := public._socio_da_sessao(p_token);
  v_tipo text;
begin
  -- A coluna pode ser text ou jsonb: adapta o cast ao tipo real.
  select format_type(a.atttypid, a.atttypmod) into v_tipo
  from pg_attribute a
  where a.attrelid = 'public.push_subscriptions'::regclass and a.attname = 'subscricao';

  delete from public.push_subscriptions where socio_id = v_socio;
  execute format('insert into public.push_subscriptions (socio_id, subscricao) values ($1, $2::%s)', v_tipo)
  using v_socio, p_subscricao;
end;
$$;

-- -------------------------------------------------------------------------
-- 6. OPERAÇÕES DO DASHBOARD QUE TÊM DE SER "TUDO OU NADA"
-- -------------------------------------------------------------------------
create or replace function public.aprovar_aula(p_aula_id bigint, p_valor numeric)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_aula public.aulas_particulares%rowtype;
begin
  if not public.is_treinador() then raise exception 'SEM_PERMISSAO'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'VALOR_INVALIDO'; end if;

  update public.aulas_particulares
  set estado = 'Aceite', valor = p_valor
  where id = p_aula_id
  returning * into v_aula;
  if not found then raise exception 'AULA_NAO_ENCONTRADA'; end if;

  insert into public.mensalidades (socio_id, mes_ano, dia_aula, hora_aula, tipo, estado, valor, aula_id)
  values (v_aula.socio_id, to_char(v_aula.data_aula::date, 'YYYY-MM'), to_char(v_aula.data_aula::date, 'DD/MM/YYYY'),
          v_aula.hora_aula, 'Aula Particular', 'Pendente', p_valor, v_aula.id);

  return jsonb_build_object('socio_id', v_aula.socio_id, 'data_aula', v_aula.data_aula);
end;
$$;

create or replace function public.faturar_aula(p_aula_id bigint, p_valor numeric)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_aula public.aulas_particulares%rowtype;
  v_fatura bigint;
begin
  if not public.is_treinador() then raise exception 'SEM_PERMISSAO'; end if;
  if p_valor is null or p_valor < 0 then raise exception 'VALOR_INVALIDO'; end if;

  update public.aulas_particulares set pago = true
  where id = p_aula_id
  returning * into v_aula;
  if not found then raise exception 'AULA_NAO_ENCONTRADA'; end if;

  -- 1º a fatura ligada a esta aula; 2º (registos antigos, sem aula_id) a fatura pendente do mesmo dia.
  select m.id into v_fatura from public.mensalidades m where m.aula_id = v_aula.id limit 1;
  if v_fatura is null then
    select m.id into v_fatura from public.mensalidades m
    where m.aula_id is null
      and m.socio_id = v_aula.socio_id
      and m.tipo = 'Aula Particular'
      and m.dia_aula = to_char(v_aula.data_aula::date, 'DD/MM/YYYY')
    order by (m.estado = 'Pendente') desc, m.id
    limit 1;
  end if;

  if v_fatura is not null then
    update public.mensalidades
    set estado = 'Pago', valor = p_valor, aula_id = v_aula.id,
        dia_aula = to_char(v_aula.data_aula::date, 'DD/MM/YYYY'), hora_aula = v_aula.hora_aula
    where id = v_fatura;
  else
    insert into public.mensalidades (socio_id, mes_ano, dia_aula, hora_aula, tipo, estado, valor, aula_id)
    values (v_aula.socio_id, to_char(v_aula.data_aula::date, 'YYYY-MM'), to_char(v_aula.data_aula::date, 'DD/MM/YYYY'),
            v_aula.hora_aula, 'Aula Particular', 'Pago', p_valor, v_aula.id);
  end if;

  return jsonb_build_object('socio_id', v_aula.socio_id, 'data_aula', v_aula.data_aula, 'hora_aula', v_aula.hora_aula);
end;
$$;

-- -------------------------------------------------------------------------
-- 7. PERMISSÕES DE EXECUÇÃO
-- -------------------------------------------------------------------------
revoke execute on function public._socio_da_sessao(text) from public, anon, authenticated;
revoke execute on function public._socio_publico(bigint) from public, anon, authenticated;

grant execute on function public.portal_login(text, text) to anon, authenticated;
grant execute on function public.portal_logout(text) to anon, authenticated;
grant execute on function public.portal_resumo(text, text, date) to anon, authenticated;
grant execute on function public.portal_historico(text) to anon, authenticated;
grant execute on function public.portal_marcar_lidas(text) to anon, authenticated;
grant execute on function public.portal_apagar_notificacao(text, bigint) to anon, authenticated;
grant execute on function public.portal_pedir_aula(text, date, time, date) to anon, authenticated;
grant execute on function public.portal_assinar_regulamento(text) to anon, authenticated;
grant execute on function public.portal_alterar_password(text, text) to anon, authenticated;
grant execute on function public.portal_tem_push(text) to anon, authenticated;
grant execute on function public.portal_guardar_push(text, text) to anon, authenticated;

revoke execute on function public.aprovar_aula(bigint, numeric) from public, anon;
revoke execute on function public.faturar_aula(bigint, numeric) from public, anon;
grant execute on function public.aprovar_aula(bigint, numeric) to authenticated;
grant execute on function public.faturar_aula(bigint, numeric) to authenticated;
grant execute on function public.is_treinador() to authenticated;
grant execute on function public.meu_treinador() to authenticated;
grant select on public.treinadores to authenticated;
drop policy if exists treinadores_leitura on public.treinadores;
create policy treinadores_leitura on public.treinadores
  for select to authenticated using (public.is_treinador());
