// Converte imagens pesadas para WebP redimensionado, usando o canvas do Chrome instalado.
// Uso: node ferramentas/otimizar-imagens.mjs <largura-max> <qualidade 0-1> <saida-dir> <imagem1> [imagem2 ...]
// Ex.: node ferramentas/otimizar-imagens.mjs 900 0.82 ../img/equipa ../img/equipa_tone.png
import fs from "node:fs";
import path from "node:path";
import { abrirBrowser } from "../lib/browser.mjs";

const [larguraMax, qualidade, saida, ...ficheiros] = process.argv.slice(2);
if (!ficheiros.length) {
  console.error("Uso: node ferramentas/otimizar-imagens.mjs <largura-max> <qualidade> <saida-dir> <imagens...>");
  process.exit(2);
}
fs.mkdirSync(saida, { recursive: true });

const tipos = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const browser = await abrirBrowser();
const pagina = await browser.newPage();
await pagina.setContent("<p>conversor</p>");

for (const ficheiro of ficheiros) {
  const tipo = tipos[path.extname(ficheiro).toLowerCase()];
  const b64 = fs.readFileSync(ficheiro).toString("base64");
  const resultado = await pagina.evaluate(
    async ([dados, mime, maxW, q]) => {
      const img = new Image();
      img.src = `data:${mime};base64,${dados}`;
      await img.decode();
      const escala = Math.min(1, maxW / img.naturalWidth);
      const w = Math.round(img.naturalWidth * escala);
      const h = Math.round(img.naturalHeight * escala);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: q });
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { b64: btoa(bin), original: `${img.naturalWidth}x${img.naturalHeight}`, novo: `${w}x${h}` };
    },
    [b64, tipo, Number(larguraMax), Number(qualidade)],
  );
  const destino = path.join(saida, `${path.basename(ficheiro, path.extname(ficheiro))}.webp`);
  fs.writeFileSync(destino, Buffer.from(resultado.b64, "base64"));
  const antes = fs.statSync(ficheiro).size;
  const depois = fs.statSync(destino).size;
  console.log(
    `${path.basename(ficheiro).padEnd(24)} ${resultado.original.padStart(10)} ${String(Math.round(antes / 1024)).padStart(6)} KB  ->  ${resultado.novo.padStart(9)} ${String(Math.round(depois / 1024)).padStart(5)} KB  (${Math.round((1 - depois / antes) * 100)}% menos)`,
  );
}
await browser.close();
