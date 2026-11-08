// Testa os cálculos das estatísticas (JS/estatisticas-calculos.js) com números feitos à mão.
// Uso: node estatisticas.test.mjs
import { criarRelatorio } from "./lib/relatorio.mjs";
import {
  paraNumero,
  ultimosMeses,
  seriesMensais,
  previsaoDoMes,
  variacao,
  escalaBonita,
} from "../JS/estatisticas-calculos.js";

const r = criarRelatorio("ESTATÍSTICAS (cálculos)");

r.ok("paraNumero aceita 35, '35€', '35,50 €', null", paraNumero(35) === 35 && paraNumero("35€") === 35 && paraNumero("35,50 €") === 35.5 && paraNumero(null) === 0);
const meses = ultimosMeses("2026-02", 4);
r.ok("ultimosMeses atravessa a mudança de ano", JSON.stringify(meses) === '["2025-11","2025-12","2026-01","2026-02"]', JSON.stringify(meses));

const dados = {
  mensalidades: [
    { socio_id: 1, mes_ano: "2026-01", valor: 35, estado: "Pago", tipo: "Mensalidade" },
    { socio_id: 2, mes_ano: "2026-01", valor: "40€", estado: "Pago", tipo: "Mensalidade" },
    { socio_id: 1, mes_ano: "2026-02", valor: 35, estado: "Pago", tipo: "Mensalidade" },
    { socio_id: 2, mes_ano: "2026-02", valor: 40, estado: "Pendente", tipo: "Mensalidade" },
    { socio_id: 3, mes_ano: "2026-02", valor: 25, estado: "Pago", tipo: "Aula Particular" },
    { socio_id: 9, mes_ano: "2025-06", valor: 999, estado: "Pago", tipo: "Mensalidade" }, // fora da janela
  ],
  vendas: [
    { data: "2026-02-03", total: 45, custo_total: 20, estado: "Paga" },
    { data: "2026-02-05", total: 10, custo_total: 4, estado: "Pendente" },
    { data: "2026-02-06", total: 30, custo_total: 10, estado: "Anulada" },
    { data: "2026-01-20", total: 8, custo_total: 3, estado: "Paga" },
  ],
  despesas: [
    { data: "2026-02-01", valor: 50 },
    { data: "2026-01-15", valor: "20" },
  ],
  socios: [
    { id: 1, estado: "Ativo", modalidade: "Kickboxing", data_inscricao: "2025-09-01" },
    { id: 2, estado: "Ativo", modalidade: "Kickboxing", data_inscricao: "2026-01-10" },
    { id: 3, estado: "Ativo", modalidade: "Aulas Particulares", data_inscricao: "2026-02-02" },
    { id: 4, estado: "Ativo", modalidade: "Boxe", data_inscricao: "2026-02-04" },
    { id: 5, estado: "Inativo", modalidade: "Boxe", data_inscricao: "2025-12-01", data_inativo: "2026-02-10" },
    { id: 6, estado: "Ativo", modalidade: "Boxe", data_inscricao: "2025-01-01", data_inativo: "2025-10-01", data_reentrada: "2026-01-05" },
    { id: 7, estado: "Ativo", modalidade: "Boxe", data_inscricao: "2026-03-01" }, // ainda não inscrito em fevereiro
  ],
};

const series = seriesMensais(ultimosMeses("2026-02", 2), dados);
const [jan, fev] = series;
r.ok("Receita de mensalidades: só as pagas (jan 35+40=75; fev 35+25=60)", jan.mensalidades === 75 && fev.mensalidades === 60, JSON.stringify(series));
r.ok("Vendas: só as pagas, anuladas e pendentes fora (fev 45, lucro 25)", fev.vendas === 45 && fev.lucroVendas === 25 && jan.vendas === 8);
r.ok("Despesas por mês (jan 20, fev 50)", jan.despesas === 20 && fev.despesas === 50);
r.ok("Resultado = mensalidades + lucro vendas - despesas (jan 75+5-20=60; fev 60+25-50=35)", jan.resultado === 60 && fev.resultado === 35);
r.ok("Entradas contam inscrições e reentradas (jan: sócio 2 + reentrada 6 = 2)", jan.entradas === 2);
r.ok("Fevereiro: 2 entradas (sócios 3 e 4) e 1 saída (sócio 5)", fev.entradas === 2 && fev.saidas === 1);

// Previsão: fevereiro visto a 14 de fevereiro (mês corrente)
const p = previsaoDoMes("2026-02", dados, new Date(2026, 1, 14));
r.ok("Previsão: recebido = 35 + 25 (aulas) + 45 (venda paga) = 105", p.recebido === 105, JSON.stringify(p));
r.ok("Previsão: por receber = 40 (mensalidade) + 10 (venda pendente) = 50", p.porReceber === 50);
// Sem mensalidade em fevereiro: sócio 4 e 6 (ativos, não só-PT, inscritos até fim de fev). Sócio 7 inscreve-se em março.
r.ok("Previsão: 2 sócios ativos sem mensalidade lançada (PT-only e futuros excluídos)", p.semFatura === 2, `semFatura=${p.semFatura}`);
// Média das mensalidades (jan 35, 40; fev 35, 40) = 37.5
r.ok("Previsão: mensalidade média 37,50 € e estimado 2 × 37,50 = 75", p.mensalidadeMedia === 37.5 && p.estimado === 75);
// Vendas não anuladas até dia 14: 45 + 10 = 55 -> ritmo 55/14 × 28 = 110 -> faltam 55
r.ok("Previsão: vendas ao ritmo atual até ao fim do mês (+55)", p.vendasPrevistas === 55, `vendasPrevistas=${p.vendasPrevistas}`);
r.ok("Previsão: total = 105 + 50 + 75 + 55 = 285", p.total === 285);

// Congelar o sócio 4 em fevereiro: deixa de contar como mensalidade estimada.
const pCongelado = previsaoDoMes("2026-02", { ...dados, congelamentos: [{ socio_id: 4, mes_inicio: "2026-01", mes_fim: "2026-02" }] }, new Date(2026, 1, 14));
r.ok("Previsão: sócio congelado no mês não entra no estimado (2 → 1 sócio, 75 → 37,50)", pCongelado.semFatura === 1 && pCongelado.estimado === 37.5, JSON.stringify(pCongelado));
const pCongeladoAntes = previsaoDoMes("2026-02", { ...dados, congelamentos: [{ socio_id: 4, mes_inicio: "2025-11", mes_fim: "2026-01" }] }, new Date(2026, 1, 14));
r.ok("Previsão: congelamento que acabou no mês anterior já não conta (volta a pagar)", pCongeladoAntes.semFatura === 2);

const fechado = previsaoDoMes("2026-01", dados, new Date(2026, 1, 14));
r.ok("Mês fechado: sem estimativas, só recebido e por receber", fechado.estado === "fechado" && fechado.estimado === 0 && fechado.vendasPrevistas === 0 && fechado.recebido === 83);
r.ok("Mês futuro identificado", previsaoDoMes("2026-03", dados, new Date(2026, 1, 14)).estado === "futuro");

r.ok("Variação percentual (+20%, -50%, sem base -> null)", variacao(120, 100) === 20 && variacao(50, 100) === -50 && variacao(10, 0) === null);
const e = escalaBonita(-35, 840);
r.ok("Escala com números redondos que inclui o zero e os extremos", e.ticks.includes(0) && e.min <= -35 && e.max >= 840 && e.ticks.every((t) => t % e.passo === 0), JSON.stringify(e));

process.exitCode = r.fim() ? 0 : 1;
