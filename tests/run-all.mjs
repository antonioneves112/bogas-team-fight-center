// Corre todos os testes por ordem. Uso: npm test   (dentro da pasta tests/)
// Para incluir a comparação visual com uma versão antiga:
//   npm test -- --visual <pasta-da-versao-antiga>
import { spawnSync } from "node:child_process";

const testes = [["regras.test.mjs"], ["sql.test.mjs"], ["e2e.test.mjs"], ["e2e-vendas.test.mjs"], ["estatisticas.test.mjs"], ["e2e-estatisticas.test.mjs"]];
const iVisual = process.argv.indexOf("--visual");
if (iVisual > -1) testes.push(["visual.test.mjs", process.argv[iVisual + 1]]);

let falhou = false;
for (const [ficheiro, ...args] of testes) {
  const res = spawnSync(process.execPath, [ficheiro, ...args], { stdio: "inherit" });
  if (res.status !== 0) falhou = true;
}
console.log(falhou ? "\n✗ HÁ TESTES A FALHAR" : "\n✓ TODOS OS TESTES PASSARAM");
process.exitCode = falhou ? 1 : 0;
