// Comparação VISUAL antes/depois: tira screenshots da versão antiga e da nova do site
// (mesmos dados, mesmo ecrã) e compara pixel a pixel. Prova que mover estilos para o CSS
// não mudou o aspeto das páginas.
// Uso: node visual.test.mjs <pasta-da-versao-antiga>
//   (cria-se com: git worktree add --detach <pasta> <commit-antigo>)
import fs from "node:fs";
import path from "node:path";
import { iniciarServidor } from "./lib/servidor.mjs";
import { abrirBrowser, TELEMOVEL, DESKTOP } from "./lib/browser.mjs";
import { MockSupabase, scriptSessaoTreinador } from "./lib/mock-supabase.mjs";
import { rpcSimuladas } from "./lib/mock-rpc.mjs";
import { tabelasBase, SOCIO_TESTE } from "./lib/dados-teste.mjs";
import { criarRelatorio } from "./lib/relatorio.mjs";

const PASTA_ANTIGA = process.argv[2];
if (!PASTA_ANTIGA || !fs.existsSync(path.join(PASTA_ANTIGA, "index.html"))) {
  console.error("Indica a pasta da versão antiga (git worktree).");
  process.exit(2);
}
const SAIDA = path.join("resultados", "visual");
fs.mkdirSync(SAIDA, { recursive: true });
const LIMITE = 0.002; // até 0,2% de pixels diferentes = igual (anti-aliasing)

// Sem animações, sem modal de boas-vindas e sem vídeos: o que se compara é o layout/CSS.
const SCRIPT_ESTAVEL = `
  sessionStorage.setItem("welcomeShown", "true");
  localStorage.setItem("bogas_pwa_dispensada", "true");
  const estilo = document.createElement("style");
  estilo.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} video{visibility:hidden!important}";
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(estilo));
`;

function dadosVisuais() {
  const t = tabelasBase();
  t.socios[1].nome = "Outro Atleta"; // sem HTML: a diferença do escape é testada no e2e
  return t;
}

const CENARIOS = [
  ...["index", "contactos", "equipa", "espaco", "gateway", "graduacoes", "horarios", "merchandising", "patrocinadores", "treinadores", "login", "portal"].map((n) => ({ nome: n, url: `${n}.html` })),
  { nome: "portal-com-sessao", url: "portal.html", sessaoAtleta: true },
  { nome: "dashboard-socios", url: "dashboard.html", treinador: true },
  { nome: "dashboard-mensalidades", url: "dashboard.html", treinador: true, acao: `document.querySelector('.tab-btn[data-target="view-mensalidades"]').click()` },
  { nome: "dashboard-aulas", url: "dashboard.html", treinador: true, acao: `document.querySelector('.tab-btn[data-target="view-aulas"]').click()` },
  { nome: "dashboard-modal-faturar", url: "dashboard.html", treinador: true, acao: `document.querySelector('.tab-btn[data-target="view-aulas"]').click(); document.querySelector('.btn-faturar-aula-direto').click()` },
  { nome: "dashboard-modal-despesa", url: "dashboard.html", treinador: true, acao: `document.getElementById('btnRegistarDespesaGlobal').click(); document.getElementById('btnOpcaoNovaDespesa').click(); document.getElementById('despesaData').value='2026-11-01'` },
  { nome: "dashboard-modal-historico-despesas", url: "dashboard.html", treinador: true, acao: `document.getElementById('btnRegistarDespesaGlobal').click(); document.getElementById('btnOpcaoHistoricoDespesa').click()` },
  { nome: "dashboard-modal-recusar", url: "dashboard.html", treinador: true, acao: `document.querySelector('.tab-btn[data-target="view-aulas"]').click(); document.querySelector('.btn-recusar-aula').click()` },
  { nome: "dashboard-modal-nova-aula", url: "dashboard.html", treinador: true, acao: `document.getElementById('btnAddAulaAdmin').click()` },
];

async function capturar(browser, raizUrl, cenario, disp, versao) {
  const mock = new MockSupabase({ tabelas: dadosVisuais(), rpc: rpcSimuladas() });
  const contexto = await browser.newContext({ ...disp, serviceWorkers: "block", locale: "pt-PT", timezoneId: "Europe/Lisbon" });
  await mock.instalar(contexto);
  // Mapa do Google: conteúdo externo que muda sozinho (não é código nosso).
  await contexto.route(/google\.com\/maps|maps\.google|maps\.googleapis|maps\.gstatic/, (rota) => rota.abort());
  await contexto.addInitScript(SCRIPT_ESTAVEL);
  if (cenario.treinador) await contexto.addInitScript(scriptSessaoTreinador("bogas@teste.pt"));
  if (cenario.sessaoAtleta) {
    // Põe as duas formas de sessão: versões anteriores a 2026-11 usam o ID,
    // as novas usam o token. Cada versão lê a que conhece.
    const { token } = mock.rpc.portal_login({ p_email: SOCIO_TESTE.email, p_password: SOCIO_TESTE.password }, mock);
    await contexto.addInitScript(
      `localStorage.setItem("bogas_atleta_id", "${SOCIO_TESTE.id}"); localStorage.setItem("bogas_portal_token", "${token}");`,
    );
  }
  const p = await contexto.newPage();
  await p.goto(`${raizUrl}/${cenario.url}`, { waitUntil: "load", timeout: 90000 });
  await p.waitForTimeout(1800);
  if (cenario.acao) {
    await p.evaluate(cenario.acao);
    await p.waitForTimeout(900);
  }
  // Remove avisos temporários (toasts) que aparecem a meio
  await p.evaluate(() => document.getElementById("toast-container")?.replaceChildren());
  const png = await p.screenshot({ fullPage: !cenario.acao });
  await contexto.close();
  return png;
}

async function comparar(paginaComparacao, a, b) {
  return paginaComparacao.evaluate(
    async ([x, y]) => {
      const carregar = async (b64) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        return img;
      };
      const [ia, ib] = await Promise.all([carregar(x), carregar(y)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const ler = (img) => {
        const c = new OffscreenCanvas(w, h);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const da = ler(ia);
      const db = ler(ib);
      const diff = new OffscreenCanvas(w, h);
      const dctx = diff.getContext("2d");
      const out = dctx.createImageData(w, h);
      let diferentes = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (d > 30) {
          diferentes++;
          out.data.set([255, 0, 0, 255], i);
        } else {
          out.data.set([da[i] / 3, da[i + 1] / 3, da[i + 2] / 3, 255], i);
        }
      }
      dctx.putImageData(out, 0, 0);
      const blob = await diff.convertToBlob({ type: "image/png" });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { ratio: diferentes / (w * h), tamanhos: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`, diff: btoa(bin) };
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

const r = criarRelatorio("VISUAL (antes vs depois, pixel a pixel)");
const antigo = await iniciarServidor(0, PASTA_ANTIGA);
const novo = await iniciarServidor();
const browser = await abrirBrowser();
const paginaComparacao = await browser.newPage();
try {
  for (const [nomeDisp, disp] of [["telemovel", TELEMOVEL], ["desktop", DESKTOP]]) {
    for (const c of CENARIOS) {
      const antes = await capturar(browser, antigo.url, c, disp, "antes");
      const depois = await capturar(browser, novo.url, c, disp, "depois");
      const res = await comparar(paginaComparacao, antes, depois);
      const base = `${nomeDisp}-${c.nome}`;
      const igual = res.ratio <= LIMITE;
      if (!igual) {
        fs.writeFileSync(path.join(SAIDA, `${base}-antes.png`), antes);
        fs.writeFileSync(path.join(SAIDA, `${base}-depois.png`), depois);
        fs.writeFileSync(path.join(SAIDA, `${base}-diferencas.png`), Buffer.from(res.diff, "base64"));
      }
      r.ok(`${base.padEnd(42)} ${(res.ratio * 100).toFixed(3)}% diferente`, igual, `${res.tamanhos} -> ver resultados/visual/${base}-*.png`);
    }
  }
} finally {
  await browser.close();
  antigo.fechar();
  novo.fechar();
}
process.exitCode = r.fim() ? 0 : 1;
