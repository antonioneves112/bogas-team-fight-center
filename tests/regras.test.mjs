// Regra do projeto: HTML, CSS e JS NUNCA misturados.
//  - HTML: sem style="", sem <style>, sem <script> com código lá dentro, sem onclick/onsubmit/...
//  - JS: sem style="..." dentro de HTML gerado (usar classes do CSS).
// Uso: node regras.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarRelatorio } from "./lib/relatorio.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const r = criarRelatorio("REGRAS (HTML / CSS / JS separados)");

const htmls = fs.readdirSync(RAIZ).filter((f) => f.endsWith(".html"));
const jss = fs.readdirSync(path.join(RAIZ, "JS")).filter((f) => f.endsWith(".js")).map((f) => path.join("JS", f));

function procurar(ficheiro, regex) {
  const linhas = fs.readFileSync(path.join(RAIZ, ficheiro), "utf8").split(/\r?\n/);
  return linhas.flatMap((l, i) => (regex.test(l) ? [`${ficheiro}:${i + 1}: ${l.trim().slice(0, 90)}`] : []));
}

for (const f of htmls) {
  const estilos = procurar(f, /\sstyle\s*=/i);
  r.ok(`${f}: sem style="" (CSS no HTML)`, estilos.length === 0, estilos.join("\n      "));
  const blocos = procurar(f, /<style[\s>]/i);
  r.ok(`${f}: sem <style> (CSS no HTML)`, blocos.length === 0, blocos.join("\n      "));
  const scripts = procurar(f, /<script(?![^>]*\ssrc=)[^>]*>/i);
  r.ok(`${f}: sem <script> com código (JS no HTML)`, scripts.length === 0, scripts.join("\n      "));
  const eventos = procurar(f, /\son[a-z]+\s*=\s*["']/i);
  r.ok(`${f}: sem onclick/onsubmit/... (JS no HTML)`, eventos.length === 0, eventos.join("\n      "));
}

for (const f of jss) {
  const estilos = procurar(f, /style\s*=\s*["'\\]/);
  r.ok(`${f}: HTML gerado sem style=""`, estilos.length === 0, estilos.join("\n      "));
}

process.exitCode = r.fim() ? 0 : 1;
