// Testes de ponta a ponta das ESTATÍSTICAS (gráficos + previsão) no Chrome, com o Supabase simulado.
// Uso: node e2e-estatisticas.test.mjs
import { iniciarServidor } from "./lib/servidor.mjs";
import { abrirBrowser, novoContexto, TELEMOVEL, DESKTOP } from "./lib/browser.mjs";
import { MockSupabase, scriptSessaoTreinador } from "./lib/mock-supabase.mjs";
import { rpcSimuladas } from "./lib/mock-rpc.mjs";
import { tabelasBase } from "./lib/dados-teste.mjs";
import { criarRelatorio } from "./lib/relatorio.mjs";

const r = criarRelatorio("E2E ESTATÍSTICAS (browser)");
const servidor = await iniciarServidor();
const browser = await abrirBrowser();
const espera = (ms) => new Promise((res) => setTimeout(res, ms));

const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
const mesAnterior = (() => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

// Dados conhecidos: mês anterior 2 pagos (35+35) + 1 venda (45, lucro 25) + despesa 20;
// mês atual 1 pago (35), 1 pendente (40), 1 sócio ativo sem mensalidade.
function dados() {
  const t = tabelasBase();
  const vazio = { data_inativo: null, data_reentrada: null };
  t.socios = [
    { id: 1, nome: "A", estado: "Ativo", modalidade: "Kickboxing", data_inscricao: "2024-01-01", ...vazio },
    { id: 2, nome: "B", estado: "Ativo", modalidade: "Kickboxing", data_inscricao: "2024-01-01", ...vazio },
    { id: 3, nome: "C", estado: "Ativo", modalidade: "Kickboxing", data_inscricao: `${mesAtual}-01`, ...vazio },
    { id: 4, nome: "D", estado: "Inativo", modalidade: "Boxe", data_inscricao: "2024-01-01", data_inativo: `${mesAtual}-02`, data_reentrada: null },
  ];
  t.mensalidades = [
    { id: 1, socio_id: 1, mes_ano: mesAnterior, valor: 35, estado: "Pago", tipo: "Mensalidade" },
    { id: 2, socio_id: 2, mes_ano: mesAnterior, valor: 35, estado: "Pago", tipo: "Mensalidade" },
    { id: 3, socio_id: 1, mes_ano: mesAtual, valor: 35, estado: "Pago", tipo: "Mensalidade" },
    { id: 4, socio_id: 2, mes_ano: mesAtual, valor: 40, estado: "Pendente", tipo: "Mensalidade" },
  ];
  t.vendas = [{ id: 1, data: `${mesAnterior}-10`, total: 45, custo_total: 20, estado: "Paga" }];
  t.despesas = [{ id: 1, data: `${mesAnterior}-03`, valor: 20, descricao: "x", categoria: "Outros" }];
  return t;
}

async function abrir(dispositivo, tabelas = dados()) {
  const mock = new MockSupabase({ tabelas, rpc: rpcSimuladas() });
  const ctx = await novoContexto(browser, { dispositivo, mock, scriptInicial: scriptSessaoTreinador("bogas@teste.pt") });
  const p = await ctx.contexto.newPage();
  await p.goto(`${servidor.url}/dashboard.html`, { waitUntil: "load" });
  await espera(1500);
  return { ...ctx, p, mock };
}
const texto = (p, id) => p.evaluate((i) => document.getElementById(i).textContent.trim(), id);

try {
  // ---------- Telemóvel ----------
  {
    const { contexto, registo, p } = await abrir(TELEMOVEL);
    const ordem = await p.evaluate(() => [...document.querySelector(".header-actions-group").children].map((b) => b.id));
    r.ok("Botão de estatísticas fica logo a seguir ao €", ordem.indexOf("btnAbrirEstatisticas") === ordem.indexOf("btnAbrirVendas") + 1, JSON.stringify(ordem));

    const box = await p.locator("#btnAbrirEstatisticas").boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await espera(1200);
    r.ok("Toque no botão abre as estatísticas e esconde o resto", await p.evaluate(() => !document.getElementById("view-estatisticas").classList.contains("hidden") && document.getElementById("view-socios").classList.contains("hidden")));

    // Previsão do mês atual: recebido 35 + por receber 40 + estimado 1 sócio (C) × 36,25 (média de 35, 35, 35, 40)
    const previsao = await texto(p, "estPrevisaoValor");
    r.ok("Previsão = 35 + 40 + 1 × 36,25 = 111,25 €", previsao === "111,25 €", previsao);
    r.ok("Nota explica o sócio sem mensalidade e a média", (await texto(p, "estPrevisaoNota")).includes("1 sócio ativo") && (await texto(p, "estPrevisaoNota")).includes("36,25"));
    r.ok("Indicador 'Recebido no mês' = 35,00 € e desceu vs mês anterior (115 €)", (await texto(p, "estKpiRecebido")) === "35,00 €" && (await texto(p, "estKpiRecebidoDelta")).includes("▼"));
    r.ok("Sócios ativos = 3 com 1 entrada e 1 saída no mês", (await texto(p, "estKpiAtivos")) === "3" && (await texto(p, "estKpiAtivosDelta")).includes("+1 entrada") && (await texto(p, "estKpiAtivosDelta")).includes("−1 saída"));

    const barras = await p.evaluate(() => document.querySelectorAll("#estGraficoReceita .est-barra").length);
    r.ok("Gráfico de receita desenhado (barras dos meses com dados)", barras >= 3, `${barras} barras`);
    r.ok("Cada gráfico tem 12 zonas de toque (uma por mês)", await p.evaluate(() => [...document.querySelectorAll(".est-grafico")].every((g) => g.querySelectorAll(".est-alvo").length === 12)));

    const alvo = p.locator("#estGraficoReceita .est-alvo").nth(10);
    await alvo.scrollIntoViewIfNeeded();
    const b = await alvo.boundingBox();
    await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await espera(300);
    const tt = await p.evaluate(() => ({ visivel: !document.getElementById("estTooltip").classList.contains("hidden"), texto: document.getElementById("estTooltip").innerText }));
    r.ok("Tocar num mês mostra a dica com o total e as séries (mês anterior: 115 €)", tt.visivel && tt.texto.includes("115,00 €") && tt.texto.includes("Vendas de material"), JSON.stringify(tt));

    await p.evaluate(() => document.querySelector("#estGraficoResultado").closest("article").querySelector("details").open = true);
    const tabela = await p.evaluate(() => document.getElementById("estTabelaResultado").innerText);
    r.ok("Tabela do resultado: mês anterior 70 + 25 − 20 = 75,00 €", tabela.includes("75,00 €"), tabela.slice(0, 300));

    r.ok("Telemóvel: sem scroll horizontal", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    // Mudar o mês no calendário redesenha
    await p.evaluate((mes) => {
      const f = document.getElementById("filtroMesMensalidade");
      f.value = mes;
      f.dispatchEvent(new Event("change"));
    }, mesAnterior);
    await espera(1000);
    r.ok("Mudar o mês para o anterior mostra 'mês fechado' com 70 + venda 45 = 115 €", (await texto(p, "estPrevisaoTitulo")).includes("mês fechado") && (await texto(p, "estPrevisaoValor")) === "115,00 €");

    r.ok("Sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }

  // ---------- Ecrã muito estreito (320px): o cabeçalho continua a caber ----------
  {
    const { contexto, p } = await abrir({ ...TELEMOVEL, viewport: { width: 320, height: 640 } });
    const cabe = await p.evaluate(() => {
      const ultimo = document.querySelector(".header-actions-group").lastElementChild.getBoundingClientRect();
      return ultimo.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth + 1;
    });
    r.ok("320px: os botões do cabeçalho cabem no ecrã", cabe);
    await contexto.close();
  }

  // ---------- Desktop ----------
  {
    const { contexto, p } = await abrir(DESKTOP);
    await p.click("#btnAbrirEstatisticas");
    await espera(1200);
    const colunas = await p.evaluate(() => getComputedStyle(document.querySelector(".est-indicadores")).gridTemplateColumns.split(" ").length);
    r.ok("Desktop: 4 indicadores lado a lado", colunas === 4);
    await contexto.close();
  }

  // ---------- Sem tabela de vendas (migração 03 por correr) ----------
  {
    const t = dados();
    delete t.vendas;
    const { contexto, registo, p } = await abrir(TELEMOVEL, t);
    await p.click("#btnAbrirEstatisticas");
    await espera(1200);
    r.ok("Sem módulo de vendas: as estatísticas funcionam na mesma", (await texto(p, "estPrevisaoValor")).endsWith("€") && registo.erros.length === 0 && (await p.evaluate(() => document.getElementById("estMensagem").classList.contains("hidden"))));
    await contexto.close();
  }
} finally {
  await browser.close();
  servidor.fechar();
}
process.exitCode = r.fim() ? 0 : 1;
