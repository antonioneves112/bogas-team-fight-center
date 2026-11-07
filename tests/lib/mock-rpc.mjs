// Versões simuladas (em JS) das funções SQL de supabase/migracoes/01_preparar.sql.
// A lógica real é testada em sql.test.mjs; aqui só imitamos as respostas para o browser.
const sessoes = new Map();

function socioPublico(s) {
  const { password, password_hash, ...publico } = s;
  return publico;
}

function socioDaSessao(token) {
  const id = sessoes.get(token);
  if (!id) throw new Error("SESSAO_INVALIDA");
  return id;
}

export function rpcSimuladas() {
  return {
    portal_login({ p_email, p_password }, mock) {
      const s = mock.tabelas.socios.find((x) => (x.email || "").toLowerCase() === String(p_email).trim().toLowerCase());
      if (!s) return null;
      const certa = s.password ? p_password === s.password : p_password === String(s.telemovel).trim();
      if (!certa) return null;
      const token = `token-${s.id}-${Math.random().toString(36).slice(2)}-abcdefghijklmnopqrstuvwxyz`;
      sessoes.set(token, s.id);
      return { token, socio: socioPublico(s) };
    },
    portal_logout({ p_token }) {
      sessoes.delete(p_token);
      return null;
    },
    portal_resumo({ p_token, p_mes, p_hoje }, mock) {
      const id = socioDaSessao(p_token);
      const s = mock.tabelas.socios.find((x) => x.id === id);
      const aulas = mock.tabelas.aulas_particulares.filter((a) => a.socio_id === id);
      return {
        socio: socioPublico(s),
        faturas_mes: mock.tabelas.mensalidades.filter((m) => m.socio_id === id && m.mes_ano === p_mes).map(({ estado, tipo }) => ({ estado, tipo })),
        tem_aula_por_pagar: aulas.some((a) => a.estado === "Aceite" && !a.pago),
        proxima_aula: aulas.filter((a) => a.data_aula >= p_hoje).sort((a, b) => a.data_aula.localeCompare(b.data_aula))[0] || null,
        notificacoes: mock.tabelas.notificacoes.filter((n) => n.socio_id === id),
      };
    },
    portal_historico({ p_token }, mock) {
      const id = socioDaSessao(p_token);
      return mock.tabelas.mensalidades.filter((m) => m.socio_id === id);
    },
    portal_marcar_lidas({ p_token }, mock) {
      const id = socioDaSessao(p_token);
      mock.tabelas.notificacoes.filter((n) => n.socio_id === id).forEach((n) => (n.lida = true));
      return null;
    },
    portal_apagar_notificacao({ p_token, p_id }, mock) {
      const id = socioDaSessao(p_token);
      const antes = mock.tabelas.notificacoes.length;
      mock.tabelas.notificacoes = mock.tabelas.notificacoes.filter((n) => !(n.id === p_id && n.socio_id === id));
      return mock.tabelas.notificacoes.length < antes;
    },
    portal_pedir_aula({ p_token, p_data, p_hora }, mock) {
      const id = socioDaSessao(p_token);
      const dia = new Date(`${p_data}T12:00:00`).getDay();
      if (dia >= 1 && dia <= 5) throw new Error("SO_FIM_DE_SEMANA");
      mock.tabelas.aulas_particulares.push({ id: mock.proximoId++, socio_id: id, data_aula: p_data, hora_aula: `${p_hora}:00`, estado: "Pendente", valor: null, pago: false });
      return { id: mock.proximoId, nome: mock.tabelas.socios.find((s) => s.id === id).nome };
    },
    portal_assinar_regulamento({ p_token }, mock) {
      const id = socioDaSessao(p_token);
      mock.tabelas.socios.find((s) => s.id === id).regulamento_aceite = true;
      return null;
    },
    portal_alterar_password({ p_token, p_nova }, mock) {
      const id = socioDaSessao(p_token);
      if (!p_nova || p_nova.length < 4) throw new Error("PASSWORD_CURTA");
      mock.tabelas.socios.find((s) => s.id === id).password = p_nova;
      return null;
    },
    portal_tem_push({ p_token }, mock) {
      const id = socioDaSessao(p_token);
      return mock.tabelas.push_subscriptions.some((p) => p.socio_id === id);
    },
    portal_guardar_push({ p_token, p_subscricao }, mock) {
      const id = socioDaSessao(p_token);
      mock.tabelas.push_subscriptions = mock.tabelas.push_subscriptions.filter((p) => p.socio_id !== id);
      mock.tabelas.push_subscriptions.push({ socio_id: id, subscricao: p_subscricao });
      return null;
    },
    meu_treinador() {
      return "Bogas";
    },
    aprovar_aula({ p_aula_id, p_valor }, mock) {
      const a = mock.tabelas.aulas_particulares.find((x) => x.id === p_aula_id);
      if (!a) throw new Error("AULA_NAO_ENCONTRADA");
      Object.assign(a, { estado: "Aceite", valor: p_valor });
      mock.tabelas.mensalidades.push({ id: mock.proximoId++, socio_id: a.socio_id, mes_ano: a.data_aula.slice(0, 7), dia_aula: a.data_aula.split("-").reverse().join("/"), hora_aula: a.hora_aula, tipo: "Aula Particular", estado: "Pendente", valor: p_valor, aula_id: a.id });
      return { socio_id: a.socio_id, data_aula: a.data_aula };
    },
    faturar_aula({ p_aula_id, p_valor }, mock) {
      const a = mock.tabelas.aulas_particulares.find((x) => x.id === p_aula_id);
      if (!a) throw new Error("AULA_NAO_ENCONTRADA");
      a.pago = true;
      const f = mock.tabelas.mensalidades.find((m) => m.aula_id === a.id);
      if (f) Object.assign(f, { estado: "Pago", valor: p_valor });
      else mock.tabelas.mensalidades.push({ id: mock.proximoId++, socio_id: a.socio_id, mes_ano: a.data_aula.slice(0, 7), tipo: "Aula Particular", estado: "Pago", valor: p_valor, aula_id: a.id });
      return { socio_id: a.socio_id, data_aula: a.data_aula, hora_aula: a.hora_aula };
    },
  };
}
