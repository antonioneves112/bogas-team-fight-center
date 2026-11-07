// Mini-relatório de testes: regista cada verificação e mostra o resumo no fim.
export function criarRelatorio(titulo) {
  const resultados = [];
  console.log(`\n=== ${titulo} ===`);
  return {
    ok(descricao, condicao, detalhe = "") {
      const passou = !!condicao;
      resultados.push({ descricao, passou });
      console.log(`${passou ? "  ✓" : "  ✗"} ${descricao}${!passou && detalhe ? `\n      -> ${detalhe}` : ""}`);
      return passou;
    },
    fim() {
      const falhas = resultados.filter((r) => !r.passou).length;
      console.log(`--- ${titulo}: ${resultados.length - falhas}/${resultados.length} passaram${falhas ? ` (${falhas} FALHARAM)` : ""}`);
      return falhas === 0;
    },
  };
}
