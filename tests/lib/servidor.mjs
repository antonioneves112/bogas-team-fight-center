// Servidor estático mínimo que serve a raiz do projeto (equivalente ao alojamento real).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// BOGAS_RAIZ permite servir outra cópia do site (ex.: a versão antiga, para comparar).
const RAIZ = process.env.BOGAS_RAIZ
  ? path.resolve(process.env.BOGAS_RAIZ)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
};

export function iniciarServidor(porta = 0, raiz = RAIZ) {
  const RAIZ_SERVIDA = path.resolve(raiz);
  const servidor = http.createServer((req, res) => {
    const caminhoUrl = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const ficheiro = path.join(RAIZ_SERVIDA, caminhoUrl === "/" ? "index.html" : caminhoUrl);
    if (!ficheiro.startsWith(RAIZ_SERVIDA) || ficheiro.includes(`${path.sep}tests${path.sep}`)) {
      res.writeHead(403).end();
      return;
    }
    fs.stat(ficheiro, (erro, stat) => {
      if (erro || !stat.isFile()) {
        res.writeHead(404).end("404");
        return;
      }
      res.writeHead(200, {
        "Content-Type": TIPOS[path.extname(ficheiro).toLowerCase()] || "application/octet-stream",
        "Content-Length": stat.size,
      });
      fs.createReadStream(ficheiro).pipe(res);
    });
  });
  return new Promise((resolve) => {
    servidor.listen(porta, "127.0.0.1", () => {
      resolve({ url: `http://127.0.0.1:${servidor.address().port}`, fechar: () => servidor.close() });
    });
  });
}
