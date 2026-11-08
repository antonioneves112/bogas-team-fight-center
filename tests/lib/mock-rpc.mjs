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
        tem_aula_por_pagar: aulas.some((a) => a.estado === "Aceite" && !a.pago && a.data_aula < p_hoje),
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
    // ----- Vendas e stock (03_vendas_stock.sql) -----
    guardar_produto({ p_id, p_nome, p_categoria, p_preco_compra, p_preco_venda, p_stock_minimo, p_variantes }, mock) {
      const t = mock.tabelas;
      let id = p_id;
      const dados = { nome: p_nome, categoria: p_categoria || "Outros", preco_compra: p_preco_compra, preco_venda: p_preco_venda, stock_minimo: p_stock_minimo };
      if (!id) {
        id = mock.proximoId++;
        t.produtos.push({ id, ativo: true, ...dados });
      } else Object.assign(t.produtos.find((p) => p.id === id), dados);
      const mantidos = [];
      for (const v of p_variantes) {
        if (v.id) {
          t.produto_variantes.find((x) => x.id === v.id).nome = v.nome;
          mantidos.push(v.id);
        } else {
          const nova = { id: mock.proximoId++, produto_id: id, nome: v.nome, stock: v.stock || 0 };
          t.produto_variantes.push(nova);
          mantidos.push(nova.id);
        }
      }
      t.produto_variantes = t.produto_variantes.filter((x) => x.produto_id !== id || mantidos.includes(x.id));
      return id;
    },
    repor_stock({ p_variante_id, p_quantidade, p_motivo }, mock) {
      const v = mock.tabelas.produto_variantes.find((x) => x.id === p_variante_id);
      if (v.stock + p_quantidade < 0) throw new Error("STOCK_INSUFICIENTE");
      v.stock += p_quantidade;
      mock.tabelas.stock_movimentos.push({ id: mock.proximoId++, variante_id: v.id, quantidade: p_quantidade, motivo: p_motivo, criado_em: new Date().toISOString() });
      return v.stock;
    },
    registar_venda({ p_itens, p_socio_id, p_cliente_nome, p_estado, p_metodo, p_data, p_notas }, mock) {
      const t = mock.tabelas;
      const cliente = p_socio_id ? t.socios.find((s) => s.id === p_socio_id)?.nome : p_cliente_nome;
      if (!cliente) throw new Error("CLIENTE_EM_FALTA");
      for (const i of p_itens) {
        const v = t.produto_variantes.find((x) => x.id === i.variante_id);
        if (v.stock < i.quantidade) throw new Error(`STOCK_INSUFICIENTE: (${v.nome}) — só há ${v.stock}`);
      }
      const venda = { id: mock.proximoId++, data: p_data, socio_id: p_socio_id, cliente_nome: cliente, estado: p_estado, metodo: p_metodo, notas: p_notas, total: 0, custo_total: 0 };
      for (const i of p_itens) {
        const v = t.produto_variantes.find((x) => x.id === i.variante_id);
        const p = t.produtos.find((x) => x.id === v.produto_id);
        v.stock -= i.quantidade;
        t.venda_itens.push({ id: mock.proximoId++, venda_id: venda.id, variante_id: v.id, produto_nome: p.nome, variante_nome: v.nome, quantidade: i.quantidade, preco_unitario: i.preco_unitario, custo_unitario: p.preco_compra });
        venda.total += i.preco_unitario * i.quantidade;
        venda.custo_total += p.preco_compra * i.quantidade;
      }
      t.vendas.push(venda);
      return venda.id;
    },
    marcar_venda_paga({ p_venda_id, p_metodo }, mock) {
      Object.assign(mock.tabelas.vendas.find((v) => v.id === p_venda_id), { estado: "Paga", metodo: p_metodo });
      return null;
    },
    anular_venda({ p_venda_id }, mock) {
      const venda = mock.tabelas.vendas.find((v) => v.id === p_venda_id);
      if (venda.estado === "Anulada") throw new Error("VENDA_JA_ANULADA");
      for (const i of mock.tabelas.venda_itens.filter((x) => x.venda_id === p_venda_id)) {
        mock.tabelas.produto_variantes.find((v) => v.id === i.variante_id).stock += i.quantidade;
      }
      venda.estado = "Anulada";
      return null;
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
