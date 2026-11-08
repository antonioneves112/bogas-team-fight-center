// Testes de ponta a ponta da GESTÃO DE VENDAS E STOCK (Chrome, ecrã de telemóvel, Supabase simulado).
// Uso: node e2e-vendas.test.mjs
import { iniciarServidor } from "./lib/servidor.mjs";
import { abrirBrowser, novoContexto, TELEMOVEL, DESKTOP } from "./lib/browser.mjs";
import { MockSupabase, scriptSessaoTreinador } from "./lib/mock-supabase.mjs";
import { rpcSimuladas } from "./lib/mock-rpc.mjs";
import { tabelasBase, SOCIO_TESTE, MES_ATUAL } from "./lib/dados-teste.mjs";
import { criarRelatorio } from "./lib/relatorio.mjs";

const r = criarRelatorio("E2E VENDAS E STOCK (browser)");
const servidor = await iniciarServidor();
const browser = await abrirBrowser();
const espera = (ms) => new Promise((res) => setTimeout(res, ms));

const novoMock = () => new MockSupabase({ tabelas: tabelasBase(), rpc: rpcSimuladas() });
const toasts = (p) => p.evaluate(() => document.getElementById("toast-container")?.innerText || "");
const limparToasts = (p) => p.evaluate(() => document.getElementById("toast-container")?.replaceChildren());
async function definir(p, id, valor) {
  await p.evaluate(
    ([i, v]) => {
      const el = document.getElementById(i);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    },
    [id, valor],
  );
}
const clicar = (p, s) => p.evaluate((x) => document.querySelector(x).click(), s);
const submeter = (p, id) => p.evaluate((i) => document.getElementById(i).requestSubmit(), id);
const visivel = (p, id) => p.evaluate((i) => !document.getElementById(i).classList.contains("hidden"), id);

async function abrirDashboard(mock, dispositivo = TELEMOVEL) {
  const ctx = await novoContexto(browser, { dispositivo, mock, scriptInicial: scriptSessaoTreinador("bogas@teste.pt") });
  const p = await ctx.contexto.newPage();
  await p.goto(`${servidor.url}/dashboard.html`, { waitUntil: "load" });
  await espera(1500);
  return { ...ctx, p };
}

try {
  const mock = novoMock();
  const { contexto, registo, p } = await abrirDashboard(mock);

  // ---------- Botão € ----------
  const posicao = await p.evaluate(() => {
    const filtro = document.getElementById("filtroMesMensalidade");
    return filtro.nextElementSibling?.id;
  });
  r.ok("Botão € fica logo a seguir ao calendário", posicao === "btnAbrirVendas");
  await clicar(p, "#btnAbrirVendas");
  await espera(800);
  r.ok("Botão € abre a área de vendas e esconde as outras", (await visivel(p, "view-vendas")) && !(await visivel(p, "view-socios")));
  r.ok("Título mostra o mês", (await p.textContent("#tituloVendas")).startsWith("Vendas — "));
  r.ok("Produto existente aparece com o stock", (await p.innerText("#tabelaProdutos")).includes("Ligaduras") || (await p.evaluate(() => document.getElementById("tabelaProdutos").textContent)).includes("Ligaduras"));

  // ---------- Criar produto com tamanhos ----------
  await clicar(p, "#btnNovoProduto");
  await definir(p, "produtoNome", "Luvas Bogas");
  await definir(p, "produtoCategoria", "Luvas");
  await definir(p, "produtoPrecoCompra", "20");
  await definir(p, "produtoPrecoVenda", "45");
  r.ok("Margem calculada ao escrever os preços", (await p.textContent("#produtoMargem")).includes("25.00€") && (await p.textContent("#produtoMargem")).includes("56%"));
  await clicar(p, '[data-predefinicao="10oz,12oz,14oz,16oz"]');
  const linhas = await p.evaluate(() => [...document.querySelectorAll("#listaVariantes .variante-nome")].map((i) => i.value));
  r.ok("Atalho 10-16oz cria as 4 variantes (e tira o 'Único' vazio)", JSON.stringify(linhas) === '["10oz","12oz","14oz","16oz"]', JSON.stringify(linhas));
  await p.evaluate(() => {
    const stocks = document.querySelectorAll("#listaVariantes .variante-stock");
    [3, 2, 0, 1].forEach((n, i) => (stocks[i].value = n));
  });
  await submeter(p, "formProduto");
  await espera(800);
  const chamada = mock.pedidosA("rpc", "guardar_produto")[0]?.corpo;
  r.ok("Guardar produto envia nome, preços e variantes com stock", chamada?.p_nome === "Luvas Bogas" && chamada?.p_preco_venda === 45 && chamada?.p_variantes?.[1]?.stock === 2, JSON.stringify(chamada));
  await clicar(p, '.vendas-subtab[data-painel="painelProdutos"]');
  const textoProdutos = await p.evaluate(() => document.getElementById("tabelaProdutos").innerText);
  r.ok("Produto novo mostra só os tamanhos COM stock (12oz: 2 sim, 14oz esgotado não)", textoProdutos.includes("Luvas Bogas") && textoProdutos.includes("12oz: 2") && !textoProdutos.includes("14oz"), textoProdutos);
  const dicaEsgotados = await p.evaluate((id) => document.querySelector(`#tabelaProdutos .btn-editar-produto[data-id="${id}"]`)?.closest("tr").querySelector(".stock-celula")?.getAttribute("title") || "", mock.tabelas.produtos.find((x) => x.nome === "Luvas Bogas").id);
  r.ok("Os tamanhos esgotados ficam na dica (Esgotado: 14oz)", dicaEsgotados === "Esgotado: 14oz", dicaEsgotados);
  r.ok("Stock baixo conta produtos no limite (luvas: 14oz=0, 16oz=1)", (await p.textContent("#vendasStockBaixo")).trim() === "1");

  // ---------- Nova venda a sócio, pendente ----------
  await clicar(p, "#btnNovaVenda");
  await espera(600);
  const luvasId = mock.tabelas.produtos.find((x) => x.nome === "Luvas Bogas").id;
  const v12 = mock.tabelas.produto_variantes.find((v) => v.produto_id === luvasId && v.nome === "12oz").id;
  const opcaoEsgotada = await p.evaluate(() => [...document.querySelectorAll("#vendaProduto option")].map((o) => o.textContent));
  r.ok("Lista de produtos da venda mostra preço", opcaoEsgotada.some((t) => t.includes("Luvas Bogas — 45.00€")));
  await definir(p, "vendaProduto", String(luvasId));
  const opcoesVariante = await p.evaluate(() => [...document.querySelectorAll("#vendaVariante option")].map((o) => `${o.textContent}|${o.disabled}`));
  r.ok("Variante sem stock (14oz) aparece como esgotada e bloqueada", opcoesVariante.includes("14oz — esgotado|true"), JSON.stringify(opcoesVariante));
  await definir(p, "vendaVariante", String(v12));
  await definir(p, "vendaQuantidade", "3");
  await clicar(p, "#btnAdicionarArtigo");
  r.ok("Não deixa pôr no carrinho mais do que o stock (3 > 2)", (await toasts(p)).includes("só há 2"));
  await limparToasts(p);
  await definir(p, "vendaQuantidade", "2");
  await clicar(p, "#btnAdicionarArtigo");
  r.ok("Carrinho mostra total e lucro (2×45=90, lucro 50)", (await p.textContent("#vendaTotal")) === "90.00€" && (await p.textContent("#vendaLucro")) === "50.00€");

  await definir(p, "vendaSocioPesquisa", SOCIO_TESTE.nome);
  await definir(p, "vendaEstado", "Pendente");
  r.ok("'Fica por pagar' esconde o método de pagamento", !(await visivel(p, "grupoVendaMetodo")));
  await p.evaluate(() => {
    const f = document.getElementById("formNovaVenda");
    f.requestSubmit();
    f.requestSubmit();
  });
  await espera(1000);
  const vendasRpc = mock.pedidosA("rpc", "registar_venda");
  r.ok("Dois toques em 'Registar venda' fazem 1 só venda", vendasRpc.length === 1, `${vendasRpc.length} pedidos`);
  const corpo = vendasRpc[0]?.corpo;
  r.ok("Venda enviada: sócio, pendente, sem método, 2×12oz a 45€", corpo?.p_socio_id === SOCIO_TESTE.id && corpo?.p_estado === "Pendente" && corpo?.p_metodo === null && corpo?.p_itens?.[0]?.quantidade === 2 && corpo?.p_itens?.[0]?.preco_unitario === 45, JSON.stringify(corpo));
  r.ok("Resumo: 'Por cobrar' = 90.00€ e lucro (pagas) = 0", (await p.textContent("#vendasPorCobrar")) === "90.00€" && (await p.textContent("#vendasLucro")) === "0.00€");
  await clicar(p, '.vendas-subtab[data-painel="painelVendas"]');
  const textoVendas = await p.evaluate(() => document.getElementById("tabelaVendas").innerText);
  r.ok("Venda aparece na lista como Pendente com os artigos", textoVendas.includes("2× Luvas Bogas (12oz)") && textoVendas.toLowerCase().includes("pendente"), textoVendas);

  // ---------- Receber pagamento ----------
  await clicar(p, ".btn-receber-venda");
  await definir(p, "pagarVendaMetodo", "MB Way");
  await submeter(p, "formPagarVenda");
  await espera(800);
  r.ok("Receber pagamento marca como paga com o método escolhido", mock.pedidosA("rpc", "marcar_venda_paga")[0]?.corpo?.p_metodo === "MB Way");
  r.ok("Resumo: lucro (pagas) = 50.00€ e nada por cobrar", (await p.textContent("#vendasLucro")) === "50.00€" && (await p.textContent("#vendasPorCobrar")) === "0.00€");

  // ---------- Anular ----------
  await clicar(p, ".btn-anular-venda");
  await clicar(p, "#btnConfirmarAnularVenda");
  await espera(800);
  r.ok("Anular venda chama anular_venda e devolve stock (12oz volta a 2)", mock.pedidosA("rpc", "anular_venda").length === 1 && mock.tabelas.produto_variantes.find((v) => v.id === v12).stock === 2);
  r.ok("Venda anulada fica riscada e sem botões", (await p.evaluate(() => document.querySelector("#tabelaVendas tr.venda-anulada") !== null && !document.querySelector(".btn-anular-venda"))));

  // ---------- Não sócio ----------
  await limparToasts(p);
  await clicar(p, "#btnNovaVenda");
  await espera(500);
  await clicar(p, 'input[name="tipoCliente"][value="externo"]');
  r.ok("Opção 'Não sócio' mostra o campo do nome", await visivel(p, "grupoClienteExterno"));
  await definir(p, "vendaProduto", "500");
  await clicar(p, "#btnAdicionarArtigo");
  await submeter(p, "formNovaVenda");
  await espera(400);
  r.ok("Não sócio sem nome é recusado no browser", (await toasts(p)).includes("nome do cliente") && mock.pedidosA("rpc", "registar_venda").length === 1);
  await definir(p, "vendaClienteNome", "Cliente Balcão");
  await definir(p, "vendaProduto", "500");
  await definir(p, "vendaPreco", "6");
  await clicar(p, "#btnAdicionarArtigo");
  await submeter(p, "formNovaVenda");
  await espera(800);
  const venda2 = mock.pedidosA("rpc", "registar_venda")[1]?.corpo;
  r.ok("Venda a não sócio paga, com 2 linhas (8€ e com desconto 6€) e método Dinheiro", venda2?.p_socio_id === null && venda2?.p_cliente_nome === "Cliente Balcão" && venda2?.p_metodo === "Dinheiro" && venda2?.p_itens.some((i) => i.preco_unitario === 6), JSON.stringify(venda2));

  // ---------- Stock: entrada ----------
  await clicar(p, '.vendas-subtab[data-painel="painelProdutos"]');
  await clicar(p, `.btn-stock-produto[data-id="${luvasId}"]`);
  await espera(500);
  await definir(p, "stockVariante", String(mock.tabelas.produto_variantes.find((v) => v.produto_id === luvasId && v.nome === "14oz").id));
  await definir(p, "stockQuantidade", "-2");
  await submeter(p, "formStock");
  await espera(300);
  r.ok("Entrada com quantidade negativa é recusada", (await toasts(p)).includes("positiva") && mock.pedidosA("rpc", "repor_stock").length === 0);
  await definir(p, "stockQuantidade", "5");
  await submeter(p, "formStock");
  await espera(800);
  r.ok("Entrada de 5 unidades no 14oz", mock.pedidosA("rpc", "repor_stock")[0]?.corpo?.p_quantidade === 5 && (await p.evaluate(() => document.getElementById("tabelaProdutos").innerText)).includes("14oz: 5"));

  // ---------- Arquivar ----------
  await clicar(p, `.btn-arquivar-produto[data-id="500"]`);
  await espera(800);
  r.ok("Arquivar esconde o produto da lista", !(await p.evaluate(() => document.getElementById("tabelaProdutos").innerText)).includes("Ligaduras"));

  // ---------- Telemóvel: sem scroll horizontal ----------
  const largura = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  r.ok("Telemóvel (390px): área de vendas sem scroll horizontal", largura);

  // ---------- PDF financeiro inclui vendas ----------
  await clicar(p, '.tab-btn[data-target="view-mensalidades"]');
  const download = p.waitForEvent("download", { timeout: 20000 }).catch(() => null);
  await clicar(p, "#btnExportarPDF");
  const ficheiro = await download;
  let textoPdf = "";
  if (ficheiro) {
    const caminho = await ficheiro.path();
    textoPdf = (await import("node:fs")).readFileSync(caminho, "latin1");
  }
  r.ok("PDF financeiro inclui a secção de vendas e o lucro no balanço", textoPdf.includes("VENDAS DE MATERIAL") && textoPdf.includes("Lucro das Vendas pagas"), ficheiro ? "texto não encontrado" : "sem download");

  r.ok("Sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
  await contexto.close();

  // ---------- BD sem a migração 03: mensagem clara, resto do dashboard intacto ----------
  {
    const m = novoMock();
    for (const t of ["produtos", "produto_variantes", "vendas", "venda_itens", "stock_movimentos"]) delete m.tabelas[t];
    const { contexto: c2, registo: reg2, p: p2 } = await abrirDashboard(m);
    await clicar(p2, "#btnAbrirVendas");
    await espera(800);
    r.ok("Sem migração 03: aparece aviso claro em vez de erro", (await p2.evaluate(() => document.getElementById("tabelaVendas").innerText)).includes("03_vendas_stock.sql"));
    await clicar(p2, '.tab-btn[data-target="view-mensalidades"]');
    const dl = p2.waitForEvent("download", { timeout: 20000 }).catch(() => null);
    await clicar(p2, "#btnExportarPDF");
    r.ok("Sem migração 03: PDF financeiro continua a funcionar", !!(await dl));
    r.ok("Sem migração 03: sem erros de JavaScript", reg2.erros.length === 0, reg2.erros.join(" | "));
    await c2.close();
  }

  // ---------- Desktop ----------
  {
    const { contexto: c3, p: p3 } = await abrirDashboard(novoMock(), DESKTOP);
    await clicar(p3, "#btnAbrirVendas");
    await espera(800);
    const colunas = await p3.evaluate(() => getComputedStyle(document.querySelector(".vendas-resumo")).gridTemplateColumns.split(" ").length);
    r.ok("Desktop: os 4 cartões de resumo ficam lado a lado", colunas === 4, `${colunas} colunas`);
    await c3.close();
  }
} finally {
  await browser.close();
  servidor.fechar();
}
process.exitCode = r.fim() ? 0 : 1;
