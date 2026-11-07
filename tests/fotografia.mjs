// "Fotografia" do estado do site: abre todas as páginas (telemóvel e desktop) e regista
// erros de JavaScript, ficheiros em falta (404) e peso descarregado.
// Uso: node fotografia.mjs <nome>   -> grava resultados/<nome>.json
// Serve para comparar ANTES vs DEPOIS de uma alteração.
import fs from "node:fs";
import { iniciarServidor } from "./lib/servidor.mjs";
import { abrirBrowser, novoContexto, TELEMOVEL, DESKTOP } from "./lib/browser.mjs";
import { MockSupabase, scriptSessaoTreinador } from "./lib/mock-supabase.mjs";
import { tabelasBase } from "./lib/dados-teste.mjs";
import { rpcSimuladas } from "./lib/mock-rpc.mjs";

export const PAGINAS = [
  "index.html",
  "contactos.html",
  "equipa.html",
  "espaco.html",
  "gateway.html",
  "graduacoes.html",
  "horarios.html",
  "login.html",
  "merchandising.html",
  "patrocinadores.html",
  "portal.html",
  "treinadores.html",
  "dashboard.html",
];

// Ruído externo que não depende do nosso código (ex.: websockets do Realtime bloqueados no teste).
const RUIDO = [/WebSocket/i, /realtime/i, /ERR_INTERNET_DISCONNECTED/i];

export async function tirarFotografia() {
  const servidor = await iniciarServidor();
  const browser = await abrirBrowser();
  const resultado = {};
  try {
    for (const [nomeDisp, disp] of [["telemovel", TELEMOVEL], ["desktop", DESKTOP]]) {
      for (const pagina of PAGINAS) {
        const mock = new MockSupabase({ tabelas: tabelasBase(), rpc: rpcSimuladas() });
        const { contexto, registo } = await novoContexto(browser, {
          dispositivo: disp,
          mock,
          scriptInicial: pagina === "dashboard.html" ? scriptSessaoTreinador("bogas@teste.pt") : undefined,
        });
        const p = await contexto.newPage();
        await p.goto(`${servidor.url}/${pagina}`, { waitUntil: "load", timeout: 90000 });
        await p.waitForTimeout(2000);
        const largura = await p.evaluate(() => ({
          documento: document.documentElement.scrollWidth,
          ecra: window.innerWidth,
        }));
        const tabelas = await p.evaluate(() =>
          Object.fromEntries(
            [...document.querySelectorAll("tbody[id]")].map((t) => [
              t.id,
              t.innerText.replace(/\s+/g, " ").trim(),
            ]),
          ),
        );
        resultado[`${nomeDisp}/${pagina}`] = {
          tabelas,
          urlFinal: p.url().replace(servidor.url, ""),
          errosJS: [...new Set(registo.erros)],
          errosConsola: [...new Set(registo.consola)].filter((t) => !RUIDO.some((r) => r.test(t))),
          ficheiros404: [...new Set(registo.falhas404.map((u) => u.replace(servidor.url, "")))],
          kbDescarregados: Math.round(registo.bytes / 1024),
          scrollHorizontal: largura.documento > largura.ecra + 1,
        };
        await contexto.close();
      }
    }
  } finally {
    await browser.close();
    servidor.fechar();
  }
  return resultado;
}

if (process.argv[1].endsWith("fotografia.mjs")) {
  const nome = process.argv[2] || "atual";
  const r = await tirarFotografia();
  fs.mkdirSync("resultados", { recursive: true });
  fs.writeFileSync(`resultados/${nome}.json`, JSON.stringify(r, null, 2));
  for (const [k, v] of Object.entries(r)) {
    const problemas = v.errosJS.length + v.errosConsola.length + v.ficheiros404.length;
    console.log(`${problemas ? "⚠" : "✓"} ${k.padEnd(34)} ${String(v.kbDescarregados).padStart(7)} KB  erros:${v.errosJS.length}/${v.errosConsola.length} 404:${v.ficheiros404.length}${v.scrollHorizontal ? " SCROLL-H" : ""}${v.urlFinal.includes(k.split("/")[1]) ? "" : " -> " + v.urlFinal}`);
  }
}
