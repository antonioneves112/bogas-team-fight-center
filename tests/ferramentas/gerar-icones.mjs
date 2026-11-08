// Gera os ícones da app (manifest / ecrã de arranque) a partir de img/PRETO.jpg (1755 px, fundo preto limpo).
//
// Porquê o PRETO.jpg e não o faviicon.png: o faviicon.png tem o xadrez de "transparência"
// do editor de imagem GRAVADO no fundo (aparecia "picotado" no ecrã de arranque) e uma
// marca de água no canto.
//
// Duas variantes:
//   "any"      -> logótipo a 88% (margem pequena) — ecrã de arranque e ícone normal
//   "maskable" -> logótipo a 70% — o Android pode recortar em círculo; a zona segura é o
//                 círculo central de 80%, por isso o texto da borda não pode estar lá fora.
// Reduz em passos de metade para um resultado limpo.
// Uso: node ferramentas/gerar-icones.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { abrirBrowser } from "../lib/browser.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORIGEM = path.join(RAIZ, "img", "PRETO.jpg");
const DESTINO = path.join(RAIZ, "img", "icones");
const ICONES = [
  { nome: "icon-192.png", tamanho: 192, escala: 0.88 },
  { nome: "icon-512.png", tamanho: 512, escala: 0.88 },
  { nome: "icon-maskable-512.png", tamanho: 512, escala: 0.7 },
  { nome: "apple-touch-icon.png", tamanho: 180, escala: 0.88 },
];

fs.mkdirSync(DESTINO, { recursive: true });
const browser = await abrirBrowser();
const pagina = await browser.newPage();
await pagina.setContent("<p>icones</p>");

const resultado = await pagina.evaluate(
  async ([b64, icones]) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${b64}`;
    await img.decode();

    const reduzir = (fonte, larguraFonte, alvo) => {
      let atual = fonte;
      let w = larguraFonte;
      while (w / 2 >= alvo) {
        w = Math.round(w / 2);
        const c = new OffscreenCanvas(w, w);
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(atual, 0, 0, w, w);
        atual = c;
      }
      const c = new OffscreenCanvas(alvo, alvo);
      const ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(atual, 0, 0, alvo, alvo);
      return c;
    };

    const saida = {};
    for (const { nome, tamanho, escala } of icones) {
      const logo = Math.round(tamanho * escala);
      const reduzido = reduzir(img, img.naturalWidth, logo);
      const c = new OffscreenCanvas(tamanho, tamanho);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#000000"; // o mesmo preto do PRETO.jpg: sem "quadrado" visível
      ctx.fillRect(0, 0, tamanho, tamanho);
      const margem = Math.round((tamanho - logo) / 2);
      ctx.drawImage(reduzido, margem, margem);
      const blob = await c.convertToBlob({ type: "image/png" });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      saida[nome] = btoa(bin);
    }
    return saida;
  },
  [fs.readFileSync(ORIGEM).toString("base64"), ICONES],
);
await browser.close();

for (const { nome } of ICONES) {
  const ficheiro = path.join(DESTINO, nome);
  fs.writeFileSync(ficheiro, Buffer.from(resultado[nome], "base64"));
  console.log(`${nome}: ${Math.round(fs.statSync(ficheiro).size / 1024)} KB`);
}
