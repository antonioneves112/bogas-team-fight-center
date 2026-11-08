// Testes de ponta a ponta do CONGELAMENTO de sócios (dashboard + portal), Supabase simulado.
// Uso: node e2e-congelar.test.mjs
import { iniciarServidor } from "./lib/servidor.mjs";
import { abrirBrowser, novoContexto, TELEMOVEL } from "./lib/browser.mjs";
import { MockSupabase, scriptSessaoTreinador } from "./lib/mock-supabase.mjs";
import { rpcSimuladas } from "./lib/mock-rpc.mjs";
import { tabelasBase, SOCIO_TESTE, MES_ATUAL } from "./lib/dados-teste.mjs";
import { criarRelatorio } from "./lib/relatorio.mjs";

const r = criarRelatorio("E2E CONGELAR SÓCIO (browser)");
const servidor = await iniciarServidor();
const browser = await abrirBrowser();
const espera = (ms) => new Promise((res) => setTimeout(res, ms));
const clicar = (p, s) => p.evaluate((x) => document.querySelector(x).click(), s);
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const somarMeses = (mes, n) => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function dados() {
  const t = tabelasBase();
  // Sócio 20: ativo, sem mensalidade este mês -> PENDENTE (até ser congelado)
  t.socios.push({ ...SOCIO_TESTE, id: 20, nome: "Congelar Teste Lopes", email: "lopes@teste.pt", password: "lopes123" });
  return t;
}

try {
  // ================= DASHBOARD =================
  {
    const mock = new MockSupabase({ tabelas: dados(), rpc: rpcSimuladas() });
    const { contexto, registo } = await novoContexto(browser, { dispositivo: TELEMOVEL, mock, scriptInicial: scriptSessaoTreinador("bogas@teste.pt") });
    const p = await contexto.newPage();
    await p.goto(`${servidor.url}/dashboard.html`, { waitUntil: "load" });
    await espera(1500);
    const linha = () =>
      p.evaluate(() => [...document.querySelectorAll("#tabelaSocios tr")].map((tr) => tr.innerText.replace(/\s+/g, " ")).find((l) => l.toUpperCase().includes("LOPES")) || "");
    const cartao = () => p.evaluate(() => Number(document.getElementById("pagamentosPendentes").textContent.trim()));

    r.ok("Antes: sócio sem mensalidade aparece PENDENTE", (await linha()).includes("PENDENTE"), await linha());
    const pendentesAntes = await cartao();

    await clicar(p, '.btn-congelar[data-id="20"]');
    await espera(600);
    r.ok("Botão de congelar abre o modal com o nome do sócio", (await p.evaluate(() => !document.getElementById("modalCongelar").classList.contains("hidden") && document.getElementById("congelarNome").textContent)) === "Congelar Teste Lopes");
    r.ok("Sem congelamentos anteriores: diz 'Nunca foi congelado'", (await p.innerText("#listaCongelamentos")).includes("Nunca foi congelado"));

    // Congelar este mês e o seguinte
    const fim = somarMeses(MES_ATUAL, 1);
    await p.evaluate((f) => {
      document.getElementById("congelarFim").value = f;
      document.getElementById("congelarFim").dispatchEvent(new Event("input"));
    }, fim);
    r.ok("Mostra quando volta a pagar (2 meses · volta no mês seguinte)", (await p.textContent("#congelarRegresso")).includes("2 meses congelados"));
    await p.selectOption("#congelarMotivo", "Lesão");
    await p.evaluate(() => document.getElementById("formCongelar").requestSubmit());
    await espera(1000);
    const gravado = mock.tabelas.socio_congelamentos[0];
    r.ok("Grava o congelamento (sócio, meses, motivo)", gravado?.socio_id === 20 && gravado?.mes_inicio === MES_ATUAL && gravado?.mes_fim === fim && gravado?.motivo === "Lesão", JSON.stringify(gravado));

    const textoLinha = await linha();
    r.ok(`Tabela mostra "CONGELADO ATÉ ${MESES[Number(fim.slice(5)) - 1]}" e não PENDENTE`, textoLinha.includes(`CONGELADO ATÉ ${MESES[Number(fim.slice(5)) - 1]}`) && !textoLinha.includes("PENDENTE"), textoLinha);
    r.ok("Card 'Pagamentos Pendentes' desce 1", (await cartao()) === pendentesAntes - 1, `${pendentesAntes} -> ${await cartao()}`);
    r.ok("Congelado não tem botão de faturar nem de WhatsApp", await p.evaluate(() => {
      const tr = [...document.querySelectorAll("#tabelaSocios tr")].find((t) => t.innerText.toUpperCase().includes("LOPES"));
      return !tr.querySelector(".btn-faturar") && !tr.querySelector(".btn-whatsapp");
    }));
    r.ok("Lista do modal mostra o congelamento ativo com opção de cancelar", (await p.innerText("#listaCongelamentos")).includes("Congelado agora") && (await p.evaluate(() => !!document.querySelector(".btn-cancelar-congelamento"))));

    // Cancelar volta ao normal
    await clicar(p, ".btn-cancelar-congelamento");
    await espera(1000);
    r.ok("Cancelar apaga o congelamento e o sócio volta a PENDENTE", mock.tabelas.socio_congelamentos.length === 0 && (await linha()).includes("PENDENTE"));
    r.ok("Sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }

  // ================= TERMINAR (congelamento que começou num mês anterior) =================
  {
    const t = dados();
    t.socio_congelamentos.push({ id: 700, socio_id: 20, mes_inicio: somarMeses(MES_ATUAL, -2), mes_fim: somarMeses(MES_ATUAL, 2), motivo: "Férias", notas: null });
    const mock = new MockSupabase({ tabelas: t, rpc: rpcSimuladas() });
    const { contexto, p } = await (async () => {
      const ctx = await novoContexto(browser, { mock, scriptInicial: scriptSessaoTreinador("bogas@teste.pt") });
      const pg = await ctx.contexto.newPage();
      await pg.goto(`${servidor.url}/dashboard.html`, { waitUntil: "load" });
      await espera(1500);
      return { ...ctx, p: pg };
    })();
    await clicar(p, '.btn-congelar[data-id="20"]');
    await espera(600);
    await clicar(p, ".btn-terminar-congelamento");
    await espera(1000);
    r.ok("Terminar: o último mês congelado passa a ser o anterior (este mês já paga)", mock.tabelas.socio_congelamentos[0].mes_fim === somarMeses(MES_ATUAL, -1), JSON.stringify(mock.tabelas.socio_congelamentos[0]));
    await contexto.close();
  }

  // ================= PORTAL DO ATLETA =================
  {
    const t = dados();
    t.socio_congelamentos.push({ id: 701, socio_id: 20, mes_inicio: MES_ATUAL, mes_fim: somarMeses(MES_ATUAL, 1), motivo: "Lesão", notas: null });
    const mock = new MockSupabase({ tabelas: t, rpc: rpcSimuladas() });
    const { token } = mock.rpc.portal_login({ p_email: "lopes@teste.pt", p_password: "lopes123" }, mock);
    const { contexto, registo } = await novoContexto(browser, { mock, scriptInicial: `localStorage.setItem("bogas_portal_token", "${token}")` });
    const p = await contexto.newPage();
    await p.goto(`${servidor.url}/portal.html`, { waitUntil: "load" });
    await espera(1500);
    r.ok("Portal: atleta congelado vê CONGELADO em vez de N PAGA", (await p.textContent("#statusMensalidade")).trim() === "CONGELADO");
    r.ok("Portal: diz até quando e o motivo", (await p.textContent("#mesReferencia")).includes("Congelado até") && (await p.textContent("#mesReferencia")).includes("Lesão"));
    r.ok("Portal: não abre o aviso de cobrança da mensalidade", await p.evaluate(() => document.getElementById("modalCobranca")?.classList.contains("hidden") !== false));
    r.ok("Portal: sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }
} finally {
  await browser.close();
  servidor.fechar();
}
process.exitCode = r.fim() ? 0 : 1;
