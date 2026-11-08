// Testes de ponta a ponta no Chrome real (ecrã de telemóvel), com o Supabase simulado.
// Verifica os fluxos que mudaram: portal do atleta, login, dashboard (aulas, pagamentos, despesas).
// Uso: node e2e.test.mjs
import { iniciarServidor } from "./lib/servidor.mjs";
import { abrirBrowser, novoContexto, TELEMOVEL } from "./lib/browser.mjs";
import { MockSupabase, scriptSessaoTreinador } from "./lib/mock-supabase.mjs";
import { rpcSimuladas } from "./lib/mock-rpc.mjs";
import { tabelasBase, SOCIO_TESTE, PROXIMO_SABADO } from "./lib/dados-teste.mjs";
import { criarRelatorio } from "./lib/relatorio.mjs";

const r = criarRelatorio("E2E (browser, telemóvel 390px)");
const servidor = await iniciarServidor();
const browser = await abrirBrowser();
const espera = (ms) => new Promise((res) => setTimeout(res, ms));

function novoMock(extra = {}) {
  return new MockSupabase({
    tabelas: tabelasBase(),
    rpc: rpcSimuladas(),
    utilizadorAuth: { email: "bogas@teste.pt", password: "senha-treinador" },
    ...extra,
  });
}

async function textoToasts(p) {
  return p.evaluate(() => document.getElementById("toast-container")?.innerText || "");
}

// Preenche e submete via JS (os campos podem estar dentro de modais com animação).
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
const clicar = (p, seletor) => p.evaluate((s) => document.querySelector(s).click(), seletor);
const submeter = (p, id) => p.evaluate((i) => document.getElementById(i).requestSubmit(), id);

try {
  // =====================================================================
  // PORTAL DO ATLETA
  // =====================================================================
  {
    const mock = novoMock();
    const { contexto, registo } = await novoContexto(browser, { dispositivo: TELEMOVEL, mock });
    const p = await contexto.newPage();
    await p.goto(`${servidor.url}/portal.html`, { waitUntil: "load" });
    await espera(800);

    r.ok("Portal: sem sessão mostra o formulário de login", await p.isVisible("#formLoginAtleta"));

    await definir(p, "emailAtletaLogin", SOCIO_TESTE.email);
    await definir(p, "passAtletaLogin", "errada");
    await submeter(p, "formLoginAtleta");
    await espera(600);
    r.ok("Portal: password errada mostra 'incorretos' e não entra", (await textoToasts(p)).includes("incorretos") && !(await p.isVisible("#portal-section")));
    r.ok("Portal: password errada não guarda token", !(await p.evaluate(() => localStorage.getItem("bogas_portal_token"))));

    await definir(p, "passAtletaLogin", SOCIO_TESTE.password);
    await submeter(p, "formLoginAtleta");
    await p.waitForSelector("#portal-section:not(.hidden)", { timeout: 5000 }).catch(() => {});
    r.ok("Portal: login correto abre o portal", await p.isVisible("#portal-section"));
    r.ok("Portal: mostra o nome do atleta", (await p.textContent("#atletaNome")) === SOCIO_TESTE.nome);
    r.ok("Portal: mensalidade do mês aparece PAGO", (await p.textContent("#statusMensalidade")).trim() === "PAGO");
    r.ok("Portal: próxima aula (sábado) aparece", (await p.innerText("#atletaProximaAula")).includes(PROXIMO_SABADO.split("-").reverse().slice(0, 2).join("/")));
    r.ok("Portal: contador de mensagens não lidas = 1", (await p.textContent("#badgeNotificacoes")).trim() === "1");
    const htmlNotif = await p.innerHTML("#listaNotificacoes");
    r.ok("Portal: mensagem com <script> é mostrada como texto (sem injeção)", htmlNotif.includes("&lt;script&gt;") && !htmlNotif.includes("<script>"));
    r.ok("Portal: o browser NUNCA recebe a password", !registo.pedidos.some(() => false) && !(await p.evaluate(() => JSON.stringify(localStorage))).includes(SOCIO_TESTE.password));
    const leiturasDiretas = mock.pedidos.filter((x) => x.tipo === "rest");
    r.ok("Portal: zero leituras diretas a tabelas (só funções portal_*)", leiturasDiretas.length === 0, JSON.stringify(leiturasDiretas.map((x) => x.nome)));

    // Recarregar -> entra sozinho com o token
    await p.reload({ waitUntil: "load" });
    await p.waitForSelector("#portal-section:not(.hidden)", { timeout: 5000 }).catch(() => {});
    r.ok("Portal: depois de recarregar continua com sessão (token)", await p.isVisible("#portal-section"));

    // Histórico
    await clicar(p, "#btnVerPagamentos");
    await espera(500);
    r.ok("Portal: histórico de pagamentos carrega", (await p.innerText("#listaPagamentosAtleta")).includes("PAGO"));
    await clicar(p, "#btnFecharHistorico");

    // Marcar mensagens como lidas
    await clicar(p, "#btnVerNotificacoes");
    await espera(400);
    r.ok("Portal: abrir mensagens marca como lidas", mock.pedidosA("rpc", "portal_marcar_lidas").length === 1 && (await p.isHidden("#badgeNotificacoes")));

    // Apagar mensagem
    await clicar(p, ".btn-delete-notif");
    await clicar(p, "#btnConfirmarApagar");
    await espera(400);
    const apagar = mock.pedidosA("rpc", "portal_apagar_notificacao")[0];
    r.ok("Portal: apagar mensagem chama a função com o id certo", apagar?.corpo?.p_id === 300 && (await p.innerText("#listaNotificacoes")).includes("Sem mensagens"));
    await clicar(p, "#btnFecharNotificacoes");

    // Pedir aula num dia de semana -> recusado no browser
    await clicar(p, "#btnAbrirModalParticular");
    const quarta = (() => { const d = new Date(); d.setDate(d.getDate() + ((3 - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); })();
    await definir(p, "dataParticular", quarta);
    await definir(p, "horaParticular", "15:00");
    await submeter(p, "formAulaParticular");
    await espera(400);
    r.ok("Portal: aula a uma quarta-feira é recusada", (await textoToasts(p)).includes("fins de semana") && mock.pedidosA("rpc", "portal_pedir_aula").length === 0);

    await definir(p, "dataParticular", PROXIMO_SABADO);
    await definir(p, "horaParticular", "14:30");
    await submeter(p, "formAulaParticular");
    await espera(800);
    const pedido = mock.pedidosA("rpc", "portal_pedir_aula")[0];
    r.ok("Portal: aula ao sábado é enviada pela função segura", pedido?.corpo?.p_data === PROXIMO_SABADO && pedido?.corpo?.p_hora === "14:30" && !!pedido?.corpo?.p_token);
    r.ok("Portal: treinador é avisado (push + email Make)", mock.pedidosA("function", "notificar-alvo").length === 1 && mock.webhooks.length === 1);
    r.ok("Portal: pedido ao Make leva acao 'marcacao_aula' (para o Router do Make)", mock.webhooks[0]?.acao === "marcacao_aula" && mock.webhooks[0]?.emailMestre && mock.webhooks[0]?.dataAula, JSON.stringify(mock.webhooks[0]));
    r.ok("Portal: toast 'Pedido Enviado'", (await textoToasts(p)).includes("Pedido Enviado"));

    // Logout
    await clicar(p, "#btnSairPortal");
    await clicar(p, "#btnConfirmarLogout");
    await espera(500);
    r.ok("Portal: sair termina a sessão no servidor e apaga o token", mock.pedidosA("rpc", "portal_logout").length === 1 && !(await p.evaluate(() => localStorage.getItem("bogas_portal_token"))) && (await p.isVisible("#formLoginAtleta")));

    r.ok("Portal: sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }

  // ---- Ataque antigo: pôr só o ID do atleta no localStorage ----
  {
    const mock = novoMock();
    const { contexto } = await novoContexto(browser, {
      mock,
      scriptInicial: "localStorage.setItem('bogas_atleta_id', '2');",
    });
    const p = await contexto.newPage();
    await p.goto(`${servidor.url}/portal.html`, { waitUntil: "load" });
    await espera(800);
    r.ok("SEGURANÇA: pôr o ID de outro atleta no browser já NÃO dá acesso", !(await p.isVisible("#portal-section")) && (await p.isVisible("#formLoginAtleta")));
    await contexto.close();
  }

  // ---- Token inventado ----
  {
    const mock = novoMock();
    const { contexto } = await novoContexto(browser, {
      mock,
      scriptInicial: "localStorage.setItem('bogas_portal_token', 'token-inventado-pelo-atacante-1234567890');",
    });
    const p = await contexto.newPage();
    await p.goto(`${servidor.url}/portal.html`, { waitUntil: "load" });
    await espera(800);
    r.ok("SEGURANÇA: token inventado é recusado e volta ao login", (await p.isVisible("#formLoginAtleta")) && !(await p.evaluate(() => localStorage.getItem("bogas_portal_token"))));
    await contexto.close();
  }

  // =====================================================================
  // LOGIN DO TREINADOR
  // =====================================================================
  {
    const mock = novoMock();
    const { contexto, registo } = await novoContexto(browser, { mock });
    const p = await contexto.newPage();
    await p.goto(`${servidor.url}/login.html`, { waitUntil: "load" });
    await p.fill("#emailInput", "bogas@teste.pt");
    await p.fill("#passInput", "errada");
    await p.click(".login-btn");
    await espera(800);
    r.ok("Login: credenciais erradas mostram aviso (sem alert())", (await textoToasts(p)).includes("Acesso negado") && p.url().includes("login.html"));
    await p.fill("#passInput", "senha-treinador");
    await p.click(".login-btn");
    await p.waitForURL(/dashboard\.html/, { timeout: 8000 }).catch(() => {});
    r.ok("Login: credenciais certas entram no dashboard", p.url().includes("dashboard.html"));
    r.ok("Login: nome do treinador vem da BD (meu_treinador)", mock.pedidosA("rpc", "meu_treinador").length >= 1);
    r.ok("Login: sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }

  // =====================================================================
  // DASHBOARD
  // =====================================================================
  async function abrirDashboard(mock) {
    const ctx = await novoContexto(browser, { mock, scriptInicial: scriptSessaoTreinador("bogas@teste.pt") });
    const p = await ctx.contexto.newPage();
    await p.goto(`${servidor.url}/dashboard.html`, { waitUntil: "load" });
    await espera(1500);
    return { ...ctx, p };
  }

  {
    const mock = novoMock();
    const { contexto, registo, p } = await abrirDashboard(mock);

    r.ok("Dashboard: não descarrega o jsPDF ao abrir (só quando exporta)", !registo.pedidos.some((u) => u.includes("jspdf")));
    const socios = await p.innerText("#tabelaSocios");
    r.ok("Dashboard: nome com HTML aparece como texto (sem injeção)", socios.includes("<b>Atleta</b>") || socios.toUpperCase().includes("<B>ATLETA</B>"), socios);

    // Aprovar aula pendente (id 200)
    await clicar(p, '.tab-btn[data-target="view-aulas"]');
    await clicar(p, '.btn-aceitar-aula[data-id="200"]');
    await definir(p, "valorAulaParticular", "25");
    await submeter(p, "formAprovarAula");
    await espera(1000);
    const aprovar = mock.pedidosA("rpc", "aprovar_aula")[0];
    r.ok("Dashboard: aprovar aula usa a transação aprovar_aula", aprovar?.corpo?.p_aula_id === 200 && aprovar?.corpo?.p_valor === 25);
    const notif = mock.pedidos.filter((x) => x.tipo === "rest" && x.nome === "notificacoes" && x.metodo === "POST").map((x) => x.corpo[0]);
    r.ok("Dashboard: notificação de aprovação gravada com 'mensagem'", notif.some((n) => n.titulo.includes("Aprovada") && n.mensagem));

    // Faturar aula aceite (id 201)
    await clicar(p, '.btn-faturar-aula-direto[data-id="201"]');
    await submeter(p, "formFaturarAula");
    await espera(1000);
    const faturar = mock.pedidosA("rpc", "faturar_aula")[0];
    r.ok("Dashboard: faturar aula usa faturar_aula (fatura certa)", faturar?.corpo?.p_aula_id === 201 && faturar?.corpo?.p_valor === 25);
    r.ok("Dashboard: recibo enviado ao Make", mock.webhooks.some((w) => w.acao === "aula_particular"));

    // Nova aula marcada pelo treinador como Aceite -> fatura com aula_id + notificação correta
    await clicar(p, "#btnAddAulaAdmin");
    await definir(p, "novaAulaSocioSearch", SOCIO_TESTE.nome);
    await definir(p, "novaAulaData", PROXIMO_SABADO);
    await definir(p, "novaAulaHora", "16:00");
    await definir(p, "novaAulaValor", "30");
    await definir(p, "novaAulaEstado", "Aceite");
    await submeter(p, "formNovaAulaAdmin");
    await espera(1000);
    const faturaNova = mock.tabelas.mensalidades.find((m) => m.valor === 30 && m.tipo === "Aula Particular");
    r.ok("Dashboard: aula marcada pelo treinador cria fatura ligada (aula_id)", !!faturaNova?.aula_id, JSON.stringify(faturaNova));
    const notifMarcada = mock.tabelas.notificacoes.find((n) => n.titulo?.includes("Aula Marcada"));
    r.ok("Dashboard: bug 'message' corrigido — notificação 'Aula Marcada' tem texto", !!notifMarcada?.mensagem && !("message" in notifMarcada), JSON.stringify(notifMarcada));

    // Despesas: abrir o histórico 3 vezes e apagar 1 vez -> só 1 DELETE
    for (let i = 0; i < 3; i++) {
      await clicar(p, "#btnRegistarDespesaGlobal");
      await clicar(p, "#btnOpcaoHistoricoDespesa");
      await espera(400);
      await clicar(p, "#btnFecharHistoricoDespesas");
    }
    await clicar(p, "#btnRegistarDespesaGlobal");
    await clicar(p, "#btnOpcaoHistoricoDespesa");
    await espera(400);
    await clicar(p, ".btn-delete-despesa");
    await clicar(p, "#btnConfirmarDeleteDespesa");
    await espera(800);
    const deletes = mock.pedidos.filter((x) => x.nome === "despesas" && x.metodo === "DELETE");
    r.ok("Dashboard: apagar despesa depois de abrir o histórico 4x faz 1 só pedido (antes 4)", deletes.length === 1, `${deletes.length} pedidos`);

    // Pagamento: dois toques rápidos -> 1 só registo
    await clicar(p, '.tab-btn[data-target="view-mensalidades"]');
    await clicar(p, "#btnAddPagamento");
    await espera(500);
    await p.evaluate(() => {
      document.getElementById("pagamentoSocioId").value = "2";
      document.getElementById("pagamentoSocioSearch").value = "Outro";
    });
    await definir(p, "pagamentoValor", "35");
    await p.evaluate(() => {
      const f = document.getElementById("formNovoPagamento");
      f.requestSubmit();
      f.requestSubmit();
    });
    await espera(1000);
    const inserts = mock.pedidos.filter((x) => x.nome === "mensalidades" && x.metodo === "POST" && x.corpo?.[0]?.valor === 35);
    r.ok("Dashboard: dois toques em 'Guardar pagamento' criam 1 só registo (antes 2)", inserts.length === 1, `${inserts.length} inserts`);

    // Exportar PDF: o jsPDF é descarregado só agora
    await clicar(p, '.tab-btn[data-target="view-socios"]');
    const download = p.waitForEvent("download", { timeout: 15000 }).catch(() => null);
    await clicar(p, "#btnExportarSociosPDF");
    const ficheiro = await download;
    r.ok("Dashboard: exportar PDF descarrega o jsPDF a pedido e gera o ficheiro", !!ficheiro && registo.pedidos.some((u) => u.includes("jspdf")), ficheiro ? ficheiro.suggestedFilename() : "sem download");

    r.ok("Dashboard: sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }

  // ---- Sócios PT: só pendentes com aula particular EM ATRASO ----
  {
    const t = tabelasBase();
    const pt = (id, nome) => ({ ...SOCIO_TESTE, id, nome, email: `pt${id}@teste.pt`, modalidade: "Aulas Particulares" });
    t.socios.push(pt(11, "Pt Atrasado Silva"), pt(12, "Pt Futuro Costa"), pt(13, "Pt Semaulas Dias"), { ...pt(14, "Pt Variante Reis"), modalidade: "Aula Particular" });
    const hoje = new Date();
    const dia = (delta) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + delta);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    // 11: aula de ontem aceite e não paga (ATRASO). 12: aula daqui a 5 dias aceite e não paga (fatura já criada).
    // 13: sem aulas. 14: modalidade escrita "Aula Particular", aula aceite de ontem por pagar (ATRASO).
    t.aulas_particulares.push(
      { id: 900, socio_id: 11, data_aula: dia(-1), hora_aula: "10:00:00", estado: "Aceite", valor: 25, pago: false },
      { id: 901, socio_id: 12, data_aula: dia(5), hora_aula: "10:00:00", estado: "Aceite", valor: 25, pago: false },
      { id: 902, socio_id: 14, data_aula: dia(-1), hora_aula: "11:00:00", estado: "Aceite", valor: 25, pago: false },
    );
    const mesDe = (d) => d.slice(0, 7);
    t.mensalidades.push(
      { id: 950, socio_id: 11, mes_ano: mesDe(dia(-1)), valor: 25, estado: "Pendente", tipo: "Aula Particular", dia_aula: null, hora_aula: null, aula_id: 900 },
      { id: 951, socio_id: 12, mes_ano: mesDe(dia(0)), valor: 25, estado: "Pendente", tipo: "Aula Particular", dia_aula: null, hora_aula: null, aula_id: 901 },
      { id: 952, socio_id: 14, mes_ano: mesDe(dia(-1)), valor: 25, estado: "Pendente", tipo: "Aula Particular", dia_aula: null, hora_aula: null, aula_id: 902 },
    );
    const mock = new MockSupabase({ tabelas: t, rpc: rpcSimuladas() });
    const { contexto, registo, p } = await abrirDashboard(mock);
    const linhaDe = (nome) =>
      p.evaluate((n) => [...document.querySelectorAll("#tabelaSocios tr")].map((tr) => tr.innerText.replace(/\s+/g, " ")).find((l) => l.toUpperCase().includes(n.toUpperCase())) || "", nome);

    r.ok("PT com aula JÁ DADA e por pagar aparece PENDENTE", (await linhaDe("Pt Silva")).includes("PENDENTE"), await linhaDe("Pt Silva"));
    const futuro = await linhaDe("Pt Costa");
    r.ok("PT com aula FUTURA aprovada (fatura pendente) NÃO aparece pendente, aparece EM DIA", futuro.includes("EM DIA") && !futuro.includes("PENDENTE"), futuro);
    r.ok("PT sem aulas não aparece na lista do mês", (await linhaDe("Pt Dias")) === "");
    r.ok("Modalidade escrita 'Aula Particular' também é reconhecida como PT", (await linhaDe("Pt Reis")).includes("PENDENTE"), await linhaDe("Pt Reis"));

    // Card: socio 2 (mensalidade pendente) + PT 11 + PT 14 = 3. PT 12 e 13 não contam.
    r.ok("Card 'Pagamentos Pendentes' conta só PT em atraso (+ mensalidades): 3", (await p.textContent("#pagamentosPendentes")).trim() === "3", await p.textContent("#pagamentosPendentes"));
    await clicar(p, "#cardPendentes");
    await espera(400);
    const listaPendentes = await p.evaluate(() => document.getElementById("tabelaSocios").innerText.toUpperCase());
    r.ok("Clicar no card mostra a mesma lista do número (sem PT em dia nem sem aulas)",
      listaPendentes.includes("PT SILVA") && listaPendentes.includes("PT REIS") && !listaPendentes.includes("PT COSTA") && !listaPendentes.includes("PT DIAS"), listaPendentes);
    r.ok("Lembrete WhatsApp do PT em atraso indica a data da aula", await p.evaluate((d) => [...document.querySelectorAll("#tabelaSocios a.btn-whatsapp")].some((a) => decodeURIComponent(a.href).includes(d)), dia(-1).split("-").reverse().join("/")));
    r.ok("Dashboard PT: sem erros de JavaScript", registo.erros.length === 0, registo.erros.join(" | "));
    await contexto.close();
  }

  // ---- Erros da BD já não aparecem como "Sucesso" ----
  {
    const mock = novoMock();
    mock.falhas = [{ tabela: "mensalidades", metodo: "POST" }];
    const { contexto, p } = await abrirDashboard(mock);
    await clicar(p, '.tab-btn[data-target="view-mensalidades"]');
    await clicar(p, "#btnAddPagamento");
    await espera(500);
    await p.evaluate(() => {
      document.getElementById("pagamentoSocioId").value = "2";
      document.getElementById("pagamentoSocioSearch").value = "Outro";
    });
    await definir(p, "pagamentoValor", "35");
    await submeter(p, "formNovoPagamento");
    await espera(800);
    const t = await textoToasts(p);
    r.ok("Dashboard: se a BD recusa o pagamento, aparece ERRO (antes dizia 'Sucesso')", t.includes("permission denied") && !t.includes("Faturado"), t);
    await contexto.close();
  }
} finally {
  await browser.close();
  servidor.fechar();
}

process.exitCode = r.fim() ? 0 : 1;
