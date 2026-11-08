/* JS/estatisticas.js - ESTATÍSTICAS DO DASHBOARD (gráficos + previsão do mês)
 *
 * Os números vêm de JS/estatisticas-calculos.js (funções puras e testadas).
 * Aqui só se lê a BD e se desenha. Gráficos em SVG sem bibliotecas externas;
 * cores, espessuras e tipografia estão todas em CSS/estatisticas.css.
 */
import { supabase } from "./supabase.js";
import { MESES_PT, mesLocalISO, debounce } from "./helpers.js";
import {
  MESES_CURTOS,
  ultimosMeses,
  seriesMensais,
  previsaoDoMes,
  variacao,
  escalaBonita,
} from "./estatisticas-calculos.js";

const $ = (id) => document.getElementById(id);
const SVG = "http://www.w3.org/2000/svg";

const euros = (n) =>
  `${(Number(n) || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const eurosEixo = (n) =>
  Math.abs(n) >= 10000 ? `${Math.round(n / 1000).toLocaleString("pt-PT")} mil €` : `${n.toLocaleString("pt-PT")} €`;
const nomeMes = (mes) => {
  const [ano, m] = mes.split("-");
  return `${MESES_PT[Number(m) - 1]} ${ano}`;
};
const mesCurto = (mes) => MESES_CURTOS[Number(mes.split("-")[1]) - 1];

let dados = null; // último resultado carregado (para redesenhar ao rodar o ecrã)

// ---------------------------------------------------------------------------
// LEITURA DA BASE DE DADOS (o ginásio todo, não só os sócios de um treinador)
// ---------------------------------------------------------------------------
const moduloEmFalta = (erro) =>
  erro && (["PGRST205", "42P01"].includes(erro.code) || /does not exist|Could not find/.test(erro.message || ""));

async function lerDados(mesFinal) {
  const meses = ultimosMeses(mesFinal, 12);
  const [inicio, fim] = [meses[0], meses[meses.length - 1]];
  const ultimoDia = new Date(Number(fim.slice(0, 4)), Number(fim.slice(5)), 0).getDate();
  const dataInicio = `${inicio}-01`;
  const dataFim = `${fim}-${String(ultimoDia).padStart(2, "0")}`;
  // A média da mensalidade usa até 3 meses antes do primeiro mês do gráfico.
  const inicioMensalidades = ultimosMeses(inicio, 4)[0];

  const [rMens, rVendas, rDesp, rSocios, rCong] = await Promise.all([
    supabase.from("mensalidades").select("socio_id, mes_ano, valor, estado, tipo").gte("mes_ano", inicioMensalidades).lte("mes_ano", fim),
    supabase.from("vendas").select("data, total, custo_total, estado").gte("data", dataInicio).lte("data", dataFim),
    supabase.from("despesas").select("data, valor").gte("data", dataInicio).lte("data", dataFim),
    supabase.from("socios").select("id, estado, modalidade, data_inscricao, data_inativo, data_reentrada"),
    supabase.from("socio_congelamentos").select("socio_id, mes_inicio, mes_fim").gte("mes_fim", inicio).lte("mes_inicio", fim),
  ]);
  for (const r of [rMens, rDesp, rSocios]) if (r.error) throw r.error;
  if (rVendas.error && !moduloEmFalta(rVendas.error)) throw rVendas.error;
  if (rCong.error && !moduloEmFalta(rCong.error)) throw rCong.error;

  return {
    meses,
    linhas: {
      mensalidades: rMens.data,
      vendas: rVendas.data || [],
      despesas: rDesp.data,
      socios: rSocios.data,
      congelamentos: rCong.data || [],
    },
  };
}

// ---------------------------------------------------------------------------
// GRÁFICO DE COLUNAS EM SVG
//   modo "pilha": séries empilhadas (todas positivas)
//   modo "divergente": valores positivos para cima, negativos para baixo
// ---------------------------------------------------------------------------
function el(nome, atributos = {}, pai = null) {
  const n = document.createElementNS(SVG, nome);
  for (const [k, v] of Object.entries(atributos)) n.setAttribute(k, v);
  if (pai) pai.appendChild(n);
  return n;
}

// Barra com cantos de 4px só na ponta dos dados; a base fica direita.
function caminhoBarra(x, w, yBase, yFim) {
  const altura = Math.abs(yBase - yFim);
  const r = Math.min(4, w / 2, altura);
  if (altura < 0.5) return "";
  if (yFim < yBase) {
    return `M${x},${yBase}V${yFim + r}Q${x},${yFim} ${x + r},${yFim}H${x + w - r}Q${x + w},${yFim} ${x + w},${yFim + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yFim - r}Q${x},${yFim} ${x + r},${yFim}H${x + w - r}Q${x + w},${yFim} ${x + w},${yFim - r}V${yBase}Z`;
}

function desenharColunas(contentor, { meses, series, modo, formatar, formatarEixo, rotuloFinal, linhasTooltip }) {
  contentor.replaceChildren();

  // Legenda (só com 2+ séries; uma série é nomeada pelo título)
  if (series.length > 1) {
    const legenda = document.createElement("ul");
    legenda.className = "est-legenda";
    for (const s of series) {
      const li = document.createElement("li");
      const chave = document.createElement("span");
      chave.className = `est-chave ${s.classe}`;
      li.append(chave, document.createTextNode(s.nome));
      legenda.appendChild(li);
    }
    contentor.appendChild(legenda);
  }

  const largura = Math.max(280, contentor.clientWidth || 600);
  const m = { topo: 22, direita: 8, baixo: 26, esquerda: 52 };
  const alturaPlot = 170;
  const altura = m.topo + alturaPlot + m.baixo;
  const larguraPlot = largura - m.esquerda - m.direita;

  // Totais por mês para a escala
  const somaPos = meses.map((_, i) => series.reduce((s, se) => s + Math.max(0, se.valores[i]), 0));
  const somaNeg = meses.map((_, i) => series.reduce((s, se) => s + Math.min(0, se.valores[i]), 0));
  const escala = escalaBonita(Math.min(...somaNeg), Math.max(...somaPos, 0));
  const y = (v) => m.topo + ((escala.max - v) / (escala.max - escala.min)) * alturaPlot;

  const svg = el("svg", {
    viewBox: `0 0 ${largura} ${altura}`,
    width: largura,
    height: altura,
    class: "est-svg",
    role: "img",
    "aria-label": contentor.closest("article")?.querySelector("h4")?.textContent || "Gráfico",
  });

  // Grelha e eixo Y
  for (const t of escala.ticks) {
    el("line", { x1: m.esquerda, x2: largura - m.direita, y1: y(t), y2: y(t), class: t === 0 ? "est-base" : "est-grelha" }, svg);
    const txt = el("text", { x: m.esquerda - 6, y: y(t), class: "est-eixo", "text-anchor": "end", "dominant-baseline": "middle" }, svg);
    txt.textContent = (formatarEixo || formatar)(t);
  }

  const banda = larguraPlot / meses.length;
  const larguraBarra = Math.min(24, banda * 0.62);
  const mostrarTodos = banda >= 30;

  meses.forEach((mes, i) => {
    const xCentro = m.esquerda + banda * (i + 0.5);
    const x = xCentro - larguraBarra / 2;
    const grupo = el("g", { class: "est-coluna", "data-indice": i }, svg);

    // Positivos empilhados para cima (2px de intervalo entre segmentos)
    let acumulado = 0;
    const positivos = series.filter((s) => s.valores[i] > 0);
    positivos.forEach((s, k) => {
      const v = s.valores[i];
      const yBase = y(acumulado) - (k > 0 ? 2 : 0);
      const yFim = y(acumulado + v);
      acumulado += v;
      if (yBase - yFim < 1) return;
      const ultimo = k === positivos.length - 1;
      el(
        ultimo ? "path" : "rect",
        ultimo
          ? { d: caminhoBarra(x, larguraBarra, yBase, yFim), class: `est-barra ${s.classePos || s.classe}` }
          : { x, y: yFim, width: larguraBarra, height: yBase - yFim, class: `est-barra ${s.classePos || s.classe}` },
        grupo,
      );
    });
    // Negativos para baixo
    let acumuladoNeg = 0;
    series
      .filter((s) => s.valores[i] < 0)
      .forEach((s, k) => {
        const v = s.valores[i];
        const yBase = y(acumuladoNeg) + (k > 0 ? 2 : 0);
        const yFim = y(acumuladoNeg + v);
        acumuladoNeg += v;
        if (yFim - yBase < 1) return;
        el("path", { d: caminhoBarra(x, larguraBarra, yBase, yFim), class: `est-barra ${s.classeNeg || s.classe}` }, grupo);
      });

    // Mês no eixo X
    // Em ecrãs estreitos, meses alternados — contados a partir do último, que aparece sempre.
    if (mostrarTodos || (meses.length - 1 - i) % 2 === 0) {
      const t = el("text", { x: xCentro, y: altura - 8, class: "est-eixo", "text-anchor": "middle" }, svg);
      t.textContent = mesCurto(mes);
    }

    // Área de toque/foco: a banda inteira (muito maior do que a barra)
    const alvo = el(
      "rect",
      { x: m.esquerda + banda * i, y: m.topo, width: banda, height: alturaPlot, class: "est-alvo", tabindex: 0, "data-indice": i },
      svg,
    );
    alvo.setAttribute("aria-label", `${nomeMes(mes)}: ${linhasTooltip(i).map((l) => `${l.nome} ${l.valor}`).join(", ")}`);
  });

  // Rótulo direto só do último mês, no canto superior direito (nunca por cima de outras barras).
  // O resto dos valores está no eixo, na dica e na tabela.
  if (rotuloFinal) {
    const i = meses.length - 1;
    const t = el("text", { x: largura - m.direita, y: 11, class: "est-rotulo-valor", "text-anchor": "end" }, svg);
    t.textContent = `${mesCurto(meses[i])}: ${rotuloFinal(i)}`;
  }

  contentor.appendChild(svg);

  // Dica (tooltip): uma para o gráfico inteiro, com todas as séries do mês
  const mostrar = (ev) => {
    const alvo = ev.target.closest(".est-alvo");
    if (!alvo) return;
    const i = Number(alvo.dataset.indice);
    svg.querySelectorAll(".est-coluna").forEach((g) => g.classList.toggle("ativa", Number(g.dataset.indice) === i));
    mostrarTooltip(alvo, nomeMes(meses[i]), linhasTooltip(i));
  };
  const esconder = () => {
    svg.querySelectorAll(".est-coluna.ativa").forEach((g) => g.classList.remove("ativa"));
    $("estTooltip").classList.add("hidden");
  };
  svg.addEventListener("pointermove", mostrar);
  svg.addEventListener("pointerdown", mostrar);
  svg.addEventListener("focusin", mostrar);
  svg.addEventListener("pointerleave", esconder);
  svg.addEventListener("focusout", esconder);
}

function mostrarTooltip(alvo, titulo, linhas) {
  const tt = $("estTooltip");
  tt.replaceChildren();
  const h = document.createElement("div");
  h.className = "est-tooltip-titulo";
  h.textContent = titulo;
  tt.appendChild(h);
  for (const l of linhas) {
    const linha = document.createElement("div");
    linha.className = "est-tooltip-linha";
    const chave = document.createElement("span");
    chave.className = `est-chave-linha ${l.classe || "sem-cor"}`;
    const valor = document.createElement("strong");
    valor.textContent = l.valor;
    const nome = document.createElement("span");
    nome.textContent = l.nome;
    linha.append(chave, valor, nome);
    tt.appendChild(linha);
  }
  tt.classList.remove("hidden");

  // Posição: por cima da coluna, sem sair da área
  const area = tt.offsetParent.getBoundingClientRect();
  const caixa = alvo.getBoundingClientRect();
  const larguraTt = tt.offsetWidth;
  const xCentro = caixa.left + caixa.width / 2 - area.left;
  const x = Math.min(Math.max(8, xCentro - larguraTt / 2), area.width - larguraTt - 8);
  tt.style.setProperty("--est-tt-x", `${x}px`);
  tt.style.setProperty("--est-tt-y", `${caixa.top - area.top - tt.offsetHeight - 8}px`);
}

function desenharTabela(contentor, cabecalhos, linhas) {
  const tabela = document.createElement("table");
  tabela.className = "est-tabela-dados";
  const thead = tabela.createTHead().insertRow();
  for (const c of cabecalhos) {
    const th = document.createElement("th");
    th.textContent = c;
    thead.appendChild(th);
  }
  const tbody = tabela.createTBody();
  for (const l of linhas) {
    const tr = tbody.insertRow();
    for (const c of l) tr.insertCell().textContent = c;
  }
  contentor.replaceChildren(tabela);
}

// ---------------------------------------------------------------------------
// PREVISÃO E INDICADORES
// ---------------------------------------------------------------------------
function desenharPrevisao(mes, p) {
  const titulo = $("estPrevisaoTitulo");
  const nota = $("estPrevisaoNota");
  if (p.estado === "fechado") {
    titulo.textContent = `Receita de ${nomeMes(mes)} (mês fechado)`;
    nota.textContent = "Recebido e ainda por receber neste mês.";
  } else if (p.estado === "futuro") {
    titulo.textContent = `Previsão de receita de ${nomeMes(mes)}`;
    nota.textContent = "Mês futuro: estimativa com base nos sócios ativos.";
  } else {
    titulo.textContent = `Previsão de receita de ${nomeMes(mes)}`;
    nota.textContent = p.semFatura
      ? `Inclui ${p.semFatura} sócio${p.semFatura === 1 ? "" : "s"} ativo${p.semFatura === 1 ? "" : "s"} ainda sem mensalidade lançada × ${euros(p.mensalidadeMedia)} (média recente).`
      : "Todos os sócios ativos já têm a mensalidade lançada.";
  }
  $("estPrevisaoValor").textContent = euros(p.total);

  const partes = [
    { nome: "Recebido", valor: p.recebido, classe: "est-cor-1" },
    { nome: "Por receber", valor: p.porReceber, classe: "est-cor-2" },
    { nome: "Estimado (sem mensalidade lançada)", valor: p.estimado, classe: "est-cor-3" },
    { nome: "Vendas previstas até ao fim do mês", valor: p.vendasPrevistas, classe: "est-cor-4" },
  ];
  const barra = $("estPrevisaoBarra");
  barra.replaceChildren();
  const total = p.total || 0;
  for (const parte of partes) {
    if (parte.valor <= 0 || !total) continue;
    const pct = (parte.valor / total) * 100;
    const bloco = document.createElement("div");
    bloco.className = `est-segmento ${parte.classe}`;
    bloco.style.setProperty("--est-parte", `${pct}%`);
    bloco.title = `${parte.nome}: ${euros(parte.valor)} (${Math.round(pct)}%)`;
    if (pct >= 14) bloco.textContent = `${Math.round(pct)}%`;
    barra.appendChild(bloco);
  }
  barra.setAttribute("aria-label", partes.map((x) => `${x.nome} ${euros(x.valor)}`).join(", "));

  const lista = $("estPrevisaoLegenda");
  lista.replaceChildren();
  for (const parte of partes) {
    if (parte.valor <= 0 && parte.classe !== "est-cor-1") continue;
    const li = document.createElement("li");
    const chave = document.createElement("span");
    chave.className = `est-chave ${parte.classe}`;
    const nome = document.createElement("span");
    nome.textContent = parte.nome;
    const valor = document.createElement("strong");
    valor.textContent = euros(parte.valor);
    li.append(chave, nome, valor);
    lista.appendChild(li);
  }
}

function definirDelta(id, delta, subirEhBom, texto = null) {
  const el = $(id);
  el.className = "est-delta";
  if (texto !== null) {
    el.textContent = texto;
    return;
  }
  if (delta === null) {
    el.textContent = "sem mês anterior para comparar";
    return;
  }
  const bom = delta === 0 ? null : (delta > 0) === subirEhBom;
  el.classList.add(bom === null ? "est-delta-neutro" : bom ? "est-delta-bom" : "est-delta-mau");
  el.textContent = `${delta > 0 ? "▲" : delta < 0 ? "▼" : "="} ${Math.abs(delta)}% vs mês anterior`;
}

// ---------------------------------------------------------------------------
// DESENHAR TUDO
// ---------------------------------------------------------------------------
function desenhar() {
  if (!dados) return;
  const { meses, linhas } = dados;
  const s = seriesMensais(meses, linhas);
  const atual = s[s.length - 1];
  const anterior = s[s.length - 2];
  const mes = meses[meses.length - 1];

  $("tituloEstatisticas").textContent = `Estatísticas — ${MESES_PT[Number(mes.slice(5)) - 1]}`;
  desenharPrevisao(mes, previsaoDoMes(mes, linhas));

  const recebidoAtual = atual.mensalidades + atual.vendas;
  const recebidoAnterior = anterior.mensalidades + anterior.vendas;
  $("estKpiRecebido").textContent = euros(recebidoAtual);
  definirDelta("estKpiRecebidoDelta", variacao(recebidoAtual, recebidoAnterior), true);
  $("estKpiDespesas").textContent = euros(atual.despesas);
  definirDelta("estKpiDespesasDelta", variacao(atual.despesas, anterior.despesas), false);
  $("estKpiResultado").textContent = euros(atual.resultado);
  $("estKpiResultado").classList.toggle("est-negativo", atual.resultado < 0);
  definirDelta("estKpiResultadoDelta", variacao(atual.resultado, anterior.resultado), true);
  $("estKpiAtivos").textContent = String(linhas.socios.filter((x) => x.estado === "Ativo").length);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  definirDelta(
    "estKpiAtivosDelta",
    null,
    true,
    `+${plural(atual.entradas, "entrada", "entradas")} · −${plural(atual.saidas, "saída", "saídas")} no mês`,
  );

  // 1. Receita por mês (pilha: mensalidades + vendas)
  desenharColunas($("estGraficoReceita"), {
    meses,
    modo: "pilha",
    series: [
      { nome: "Mensalidades e aulas", classe: "est-cor-1", valores: s.map((x) => x.mensalidades) },
      { nome: "Vendas de material", classe: "est-cor-2", valores: s.map((x) => x.vendas) },
    ],
    formatar: euros,
    formatarEixo: eurosEixo,
    rotuloFinal: (i) => euros(s[i].mensalidades + s[i].vendas),
    linhasTooltip: (i) => [
      { nome: "Total", valor: euros(s[i].mensalidades + s[i].vendas) },
      { nome: "Mensalidades e aulas", valor: euros(s[i].mensalidades), classe: "est-cor-1" },
      { nome: "Vendas de material", valor: euros(s[i].vendas), classe: "est-cor-2" },
    ],
  });
  desenharTabela($("estTabelaReceita"), ["Mês", "Mensalidades e aulas", "Vendas", "Total"],
    s.map((x) => [nomeMes(x.mes), euros(x.mensalidades), euros(x.vendas), euros(x.mensalidades + x.vendas)]));

  // 2. Resultado líquido (divergente: lucro para cima, prejuízo para baixo)
  desenharColunas($("estGraficoResultado"), {
    meses,
    modo: "divergente",
    series: [{ nome: "Resultado", classePos: "est-pos", classeNeg: "est-neg", valores: s.map((x) => x.resultado) }],
    formatar: euros,
    formatarEixo: eurosEixo,
    rotuloFinal: (i) => euros(s[i].resultado),
    linhasTooltip: (i) => [
      { nome: s[i].resultado >= 0 ? "Lucro" : "Prejuízo", valor: euros(s[i].resultado), classe: s[i].resultado >= 0 ? "est-pos" : "est-neg" },
      { nome: "Mensalidades e aulas", valor: euros(s[i].mensalidades) },
      { nome: "Lucro das vendas", valor: euros(s[i].lucroVendas) },
      { nome: "Despesas", valor: `− ${euros(s[i].despesas)}` },
    ],
  });
  desenharTabela($("estTabelaResultado"), ["Mês", "Mensalidades", "Lucro vendas", "Despesas", "Resultado"],
    s.map((x) => [nomeMes(x.mes), euros(x.mensalidades), euros(x.lucroVendas), euros(x.despesas), euros(x.resultado)]));

  // 3. Sócios: entradas (para cima) e saídas (para baixo)
  desenharColunas($("estGraficoSocios"), {
    meses,
    modo: "divergente",
    series: [
      { nome: "Entradas", classe: "est-pos", valores: s.map((x) => x.entradas) },
      { nome: "Saídas", classe: "est-neg", valores: s.map((x) => -x.saidas) },
    ],
    formatar: (n) => String(Math.abs(n)),
    rotuloFinal: (i) => `+${s[i].entradas} / −${s[i].saidas}`,
    linhasTooltip: (i) => [
      { nome: "Entradas", valor: String(s[i].entradas), classe: "est-pos" },
      { nome: "Saídas", valor: String(s[i].saidas), classe: "est-neg" },
      { nome: "Saldo", valor: `${s[i].entradas - s[i].saidas >= 0 ? "+" : "−"}${Math.abs(s[i].entradas - s[i].saidas)}` },
    ],
  });
  desenharTabela($("estTabelaSocios"), ["Mês", "Entradas", "Saídas", "Saldo"],
    s.map((x) => [nomeMes(x.mes), String(x.entradas), String(x.saidas), String(x.entradas - x.saidas)]));

  // 4. Vendas de material (uma série)
  desenharColunas($("estGraficoVendas"), {
    meses,
    modo: "pilha",
    series: [{ nome: "Vendas de material", classe: "est-cor-2", valores: s.map((x) => x.vendas) }],
    formatar: euros,
    formatarEixo: eurosEixo,
    rotuloFinal: (i) => euros(s[i].vendas),
    linhasTooltip: (i) => [
      { nome: "Vendido (pago)", valor: euros(s[i].vendas), classe: "est-cor-2" },
      { nome: "Lucro", valor: euros(s[i].lucroVendas) },
    ],
  });
  desenharTabela($("estTabelaVendas"), ["Mês", "Vendido (pago)", "Lucro"],
    s.map((x) => [nomeMes(x.mes), euros(x.vendas), euros(x.lucroVendas)]));
}

export async function carregarEstatisticas() {
  const area = document.querySelector("#view-estatisticas .est-area");
  const mensagem = $("estMensagem");
  area.classList.add("est-a-carregar"); // mantém o desenho anterior, esbatido
  mensagem.classList.add("hidden");
  try {
    dados = await lerDados($("filtroMesMensalidade")?.value || mesLocalISO());
    desenhar();
  } catch (erro) {
    console.error("Estatísticas:", erro);
    mensagem.textContent = `Não foi possível carregar as estatísticas: ${erro.message || "erro desconhecido"}`;
    mensagem.classList.remove("hidden");
  } finally {
    area.classList.remove("est-a-carregar");
  }
}

// ---------------------------------------------------------------------------
// EVENTOS (registados uma única vez)
// ---------------------------------------------------------------------------
const vistaVisivel = () => !$("view-estatisticas")?.classList.contains("hidden");

export function initEstatisticasEvents() {
  if (!$("view-estatisticas")) return;

  $("btnAbrirEstatisticas")?.addEventListener("click", () => {
    document.querySelectorAll(".tab-content").forEach((t) => {
      t.classList.add("hidden");
      t.classList.remove("active");
    });
    document.querySelectorAll(".tab-btn").forEach((t) => t.classList.remove("active"));
    $("view-estatisticas").classList.remove("hidden");
    $("view-estatisticas").classList.add("active");
    carregarEstatisticas();
  });

  $("filtroMesMensalidade")?.addEventListener("change", () => {
    if (vistaVisivel()) carregarEstatisticas();
  });

  // Ao rodar o telemóvel ou mudar o tamanho da janela, redesenha com a nova largura.
  window.addEventListener(
    "resize",
    debounce(() => {
      if (vistaVisivel()) desenhar();
    }, 200),
  );
}
