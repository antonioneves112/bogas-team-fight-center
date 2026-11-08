/* JS/estatisticas-calculos.js - CÁLCULOS DAS ESTATÍSTICAS (sem ecrã)
 *
 * Funções puras: recebem as linhas da base de dados e devolvem números.
 * Separadas do desenho dos gráficos para poderem ser testadas sozinhas
 * (tests/estatisticas.test.mjs).
 */

export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Converte "35", 35, "35€", "35,50 €" em número.
export function paraNumero(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const n = parseFloat(String(valor).replace(/€/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// "2026-11" -> a lista dos N meses que acabam nesse mês: ["2025-12", ..., "2026-11"]
export function ultimosMeses(mesFinal, quantidade = 12) {
  const [ano, mes] = mesFinal.split("-").map(Number);
  const lista = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(ano, mes - 1 - i, 1);
    lista.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return lista;
}

export function diasNoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(ano, m, 0).getDate();
}

const mesDe = (data) => (data ? String(data).slice(0, 7) : null);
const ehMensalidade = (tipo) => !tipo || tipo === "Mensalidade" || tipo === "Rendimento";
const ehSoAulasParticulares = (modalidade) => modalidade === "Aulas Particulares" || modalidade === "Aula Particular";

/**
 * Séries mensais para os gráficos.
 * @returns {Array<{mes, mensalidades, vendas, lucroVendas, despesas, resultado, entradas, saidas}>}
 *   mensalidades: mensalidades + aulas particulares PAGAS (receita)
 *   vendas: receita das vendas PAGAS; lucroVendas: o lucro dessas vendas
 *   resultado: mensalidades + lucro das vendas - despesas (a mesma regra do PDF)
 *   entradas: inscrições + reentradas; saidas: sócios que ficaram inativos
 */
export function seriesMensais(meses, { mensalidades = [], vendas = [], despesas = [], socios = [] }) {
  const linhas = new Map(
    meses.map((mes) => [mes, { mes, mensalidades: 0, vendas: 0, lucroVendas: 0, despesas: 0, resultado: 0, entradas: 0, saidas: 0 }]),
  );

  for (const m of mensalidades) {
    const linha = linhas.get(m.mes_ano);
    if (linha && m.estado === "Pago") linha.mensalidades += paraNumero(m.valor);
  }
  for (const v of vendas) {
    const linha = linhas.get(mesDe(v.data));
    if (linha && v.estado === "Paga") {
      linha.vendas += paraNumero(v.total);
      linha.lucroVendas += paraNumero(v.total) - paraNumero(v.custo_total);
    }
  }
  for (const d of despesas) {
    const linha = linhas.get(mesDe(d.data));
    if (linha) linha.despesas += paraNumero(d.valor);
  }
  for (const s of socios) {
    const entrada = linhas.get(mesDe(s.data_inscricao));
    if (entrada) entrada.entradas += 1;
    const reentrada = linhas.get(mesDe(s.data_reentrada));
    if (reentrada) reentrada.entradas += 1;
    const saida = linhas.get(mesDe(s.data_inativo));
    if (saida) saida.saidas += 1;
  }

  for (const linha of linhas.values()) {
    linha.resultado = linha.mensalidades + linha.lucroVendas - linha.despesas;
    for (const k of ["mensalidades", "vendas", "lucroVendas", "despesas", "resultado"]) {
      linha[k] = Math.round(linha[k] * 100) / 100;
    }
  }
  return [...linhas.values()];
}

/**
 * Previsão de receita de um mês.
 *  - recebido: mensalidades/aulas pagas + vendas pagas
 *  - porReceber: mensalidades/aulas pendentes + vendas pendentes
 *  - estimado: sócios ativos SEM mensalidade lançada no mês × mensalidade média
 *              (média das mensalidades dos últimos 3 meses + este)
 *  - vendasPrevistas: (só no mês corrente) vendas ao ritmo atual até ao fim do mês
 * @param hoje Date usada para saber se o mês é o corrente (injetável nos testes)
 */
export function previsaoDoMes(mes, { mensalidades = [], vendas = [], socios = [] }, hoje = new Date()) {
  const mesHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const estado = mes < mesHoje ? "fechado" : mes === mesHoje ? "corrente" : "futuro";

  const doMes = mensalidades.filter((m) => m.mes_ano === mes);
  const vendasDoMes = vendas.filter((v) => mesDe(v.data) === mes && v.estado !== "Anulada");

  const recebido =
    doMes.filter((m) => m.estado === "Pago").reduce((s, m) => s + paraNumero(m.valor), 0) +
    vendasDoMes.filter((v) => v.estado === "Paga").reduce((s, v) => s + paraNumero(v.total), 0);
  const porReceber =
    doMes.filter((m) => m.estado === "Pendente").reduce((s, m) => s + paraNumero(m.valor), 0) +
    vendasDoMes.filter((v) => v.estado === "Pendente").reduce((s, v) => s + paraNumero(v.total), 0);

  // Mensalidade média: mensalidades (não aulas) dos últimos 3 meses + este, com valor > 0.
  const janela = new Set(ultimosMeses(mes, 4));
  const valoresMensalidade = mensalidades
    .filter((m) => janela.has(m.mes_ano) && ehMensalidade(m.tipo) && m.tipo !== "Rendimento")
    .map((m) => paraNumero(m.valor))
    .filter((v) => v > 0);
  const mensalidadeMedia = valoresMensalidade.length
    ? valoresMensalidade.reduce((s, v) => s + v, 0) / valoresMensalidade.length
    : 0;

  let semFatura = 0;
  let estimado = 0;
  let vendasPrevistas = 0;
  if (estado !== "fechado") {
    const comMensalidade = new Set(doMes.filter((m) => ehMensalidade(m.tipo)).map((m) => m.socio_id));
    const fimDoMes = `${mes}-${String(diasNoMes(mes)).padStart(2, "0")}`;
    semFatura = socios.filter(
      (s) =>
        s.estado === "Ativo" &&
        !ehSoAulasParticulares(s.modalidade) &&
        (!s.data_inscricao || String(s.data_inscricao) <= fimDoMes) &&
        !comMensalidade.has(s.id),
    ).length;
    estimado = semFatura * mensalidadeMedia;

    if (estado === "corrente") {
      const dia = hoje.getDate();
      const total = diasNoMes(mes);
      const vendidoAteHoje = vendasDoMes.reduce((s, v) => s + paraNumero(v.total), 0);
      if (dia < total && vendidoAteHoje > 0) {
        vendasPrevistas = (vendidoAteHoje / dia) * total - vendidoAteHoje;
      }
    }
  }

  const arred = (n) => Math.round(n * 100) / 100;
  return {
    estado,
    recebido: arred(recebido),
    porReceber: arred(porReceber),
    estimado: arred(estimado),
    vendasPrevistas: arred(vendasPrevistas),
    total: arred(recebido + porReceber + estimado + vendasPrevistas),
    semFatura,
    mensalidadeMedia: arred(mensalidadeMedia),
  };
}

// Variação percentual entre dois valores (null quando não há base de comparação).
export function variacao(atual, anterior) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / Math.abs(anterior)) * 100);
}

// Escala "bonita" para o eixo: 0, 250, 500... (números redondos)
export function escalaBonita(minimo, maximo, alvo = 4) {
  const min = Math.min(0, minimo);
  const max = Math.max(0, maximo);
  if (min === max) return { min: 0, max: 1, passo: 1, ticks: [0, 1] };
  const bruto = (max - min) / alvo;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * potencia).find((p) => p >= bruto);
  const inicio = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const ticks = [];
  for (let t = inicio; t <= fim + passo / 2; t += passo) ticks.push(Math.round(t * 100) / 100);
  return { min: inicio, max: fim, passo, ticks };
}
