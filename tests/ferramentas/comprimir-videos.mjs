// Comprime vídeos MP4 para a web (H.264, máx. 720p, "faststart" para começar a tocar logo).
// Substitui o ficheiro no mesmo sítio (mesmo nome, não é preciso mudar referências),
// mas SÓ se o resultado for mais pequeno. O original fica no histórico do git.
// Uso: node ferramentas/comprimir-videos.mjs [--sem-som] <video1.mp4> [video2.mp4 ...]
//   --sem-som  tira o áudio (vídeos que tocam sempre em silêncio, ex.: slides da home)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

const args = process.argv.slice(2);
const semSom = args.includes("--sem-som");
const ficheiros = args.filter((a) => a !== "--sem-som");
if (!ficheiros.length) {
  console.error("Uso: node ferramentas/comprimir-videos.mjs [--sem-som] <videos...>");
  process.exit(2);
}

let totalAntes = 0;
let totalDepois = 0;
for (const ficheiro of ficheiros) {
  const temp = path.join(path.dirname(ficheiro), `.tmp-${path.basename(ficheiro)}`);
  const r = spawnSync(
    ffmpeg,
    [
      "-y", "-loglevel", "error", "-i", ficheiro,
      // máx. 720 px no lado menor (serve vídeo vertical e horizontal); dimensões pares para o H.264
      "-vf", "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
      "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      ...(semSom ? ["-an"] : ["-c:a", "aac", "-b:a", "96k"]),
      temp,
    ],
    { stdio: "inherit" },
  );
  const antes = fs.statSync(ficheiro).size;
  if (r.status !== 0 || !fs.existsSync(temp)) {
    console.log(`${path.basename(ficheiro)}: ERRO no ffmpeg, original mantido`);
    fs.rmSync(temp, { force: true });
    continue;
  }
  const depois = fs.statSync(temp).size;
  totalAntes += antes;
  if (depois < antes) {
    fs.renameSync(temp, ficheiro);
    totalDepois += depois;
  } else {
    fs.rmSync(temp);
    totalDepois += antes;
  }
  const kb = (n) => `${Math.round(n / 1024)} KB`.padStart(9);
  console.log(`${path.basename(ficheiro).padEnd(28)} ${kb(antes)} -> ${kb(Math.min(antes, depois))}${depois < antes ? "" : "  (mantido)"}`);
}
console.log(`TOTAL: ${Math.round(totalAntes / 1048576)} MB -> ${Math.round(totalDepois / 1048576)} MB`);
