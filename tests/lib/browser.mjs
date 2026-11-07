// Abre o Chrome instalado no computador (sem descarregar browsers) e recolhe erros das páginas.
import { chromium } from "playwright-core";
import fs from "node:fs";

const CAMINHOS_CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export async function abrirBrowser() {
  const executablePath = process.env.CHROME_PATH || CAMINHOS_CHROME.find((c) => fs.existsSync(c));
  if (!executablePath) throw new Error("Chrome não encontrado. Define CHROME_PATH.");
  return chromium.launch({ executablePath, headless: true });
}

export const TELEMOVEL = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
export const DESKTOP = { viewport: { width: 1366, height: 800 } };

// Cria um contexto isolado, com o simulador do Supabase instalado e recolha de erros.
export async function novoContexto(browser, { dispositivo = TELEMOVEL, mock, scriptInicial } = {}) {
  const contexto = await browser.newContext({ ...dispositivo, serviceWorkers: "block", locale: "pt-PT" });
  if (mock) await mock.instalar(contexto);
  if (scriptInicial) await contexto.addInitScript(scriptInicial);
  const registo = { erros: [], consola: [], falhas404: [], bytes: 0, pedidos: [] };
  contexto.on("page", (p) => ligarRegisto(p, registo));
  return { contexto, registo };
}

function ligarRegisto(pagina, registo) {
  pagina.on("pageerror", (e) => registo.erros.push(e.message));
  pagina.on("console", (m) => {
    if (m.type() === "error") registo.consola.push(m.text());
  });
  pagina.on("response", async (r) => {
    const url = r.url();
    registo.pedidos.push(url);
    if (r.status() === 404 && url.startsWith("http://127.0.0.1")) registo.falhas404.push(url);
    const tamanho = Number(r.headers()["content-length"] || 0);
    registo.bytes += tamanho;
  });
}

export async function abrirPagina(contexto, url, esperaMs = 1500) {
  const pagina = await contexto.newPage();
  await pagina.goto(url, { waitUntil: "load", timeout: 60000 });
  await pagina.waitForTimeout(esperaMs);
  return pagina;
}
