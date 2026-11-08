-- =========================================================================
-- 04_AULAS_EM_ATRASO.SQL
-- No portal, "aula por pagar" passa a ser só a aula EM ATRASO: aceite, não paga
-- e com data ANTERIOR a hoje. Uma aula futura já aprovada deixa de mostrar
-- "AULA N PAGA" (e o aviso de cobrança) antes de acontecer.
-- Mesma regra do dashboard (JS/socios.js). Idempotente.
-- =========================================================================
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
      where a.socio_id = v_socio and a.estado = 'Aceite' and a.pago = false
        and a.data_aula::date < p_hoje),
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

grant execute on function public.portal_resumo(text, text, date) to anon, authenticated;
