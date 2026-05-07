/* JS/pdfManager.js - GESTOR ESPECIALIZADO DE PDFs (Agora com Relatório Financeiro Completo) */
import { formatarNomeCurto, extrairPreco } from "./helpers.js";
import { supabase } from "./supabase.js"; // 🥊 NOVO: Precisamos de chamar a BD para ler as despesas

// 🥊 Função Base de Geração (Mantida para a lista de Sócios)
export function exportarPDF(titulo, rows, colunas, filename, footerRow = null) {
  try {
    const doc = new window.jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text("Bogas Team Fight Center", 14, 20);
    doc.setFontSize(12);
    doc.text(titulo, 14, 30);
    doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 14, 38);

    const opcoesTabela = {
      startY: 45,
      head: [colunas],
      body: rows,
      foot: footerRow ? [footerRow] : null,
      theme: "striped",
      headStyles: { fillColor: [37, 211, 102] },
      footStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      styles: { font: "helvetica", fontSize: 10 },
    };

    if (typeof doc.autoTable === "function") {
      doc.autoTable(opcoesTabela);
    } else if (
      window.jspdf &&
      window.jspdf.jsPDF &&
      typeof window.jspdf.jsPDF.autoTable === "function"
    ) {
      window.jspdf.jsPDF.autoTable(doc, opcoesTabela);
    }

    doc.save(filename);
  } catch (e) {
    console.error("Erro PDF:", e);
    alert("Erro ao gerar PDF.");
  }
}

// 🥊 Especialista na Lista de Sócios (Mantido igual)
export function exportarGuerreirosPDF(guerreiros) {
  const rows = guerreiros.map((s) => [
    formatarNomeCurto(s.nome),
    s.modalidade || "-",
    s.graduacao || "-",
    s.federacao || "Não Regularizada",
    s.estado || "Ativo",
  ]);

  exportarPDF(
    "Lista de Sócios - Bogas Team",
    rows,
    ["Nome", "Modalidade", "Graduação", "Federação", "Estado"],
    "Socios_BogasTeam.pdf",
  );
}

// 🥊 ESPECIALISTA FINANCEIRO: Mensalidades + Despesas + Balanço
export async function exportarMensalidadesPDF(mensalidades, titulo, filtroMes) {
  try {
    // 1. Ir à Base de Dados buscar as DESPESAS APENAS DESTE MÊS (Correção de Tipo de Dados)
    const ano = parseInt(filtroMes.split("-")[0]);
    const mes = parseInt(filtroMes.split("-")[1]);

    // Constrói o dia 1 e o último dia do mês (o JS é inteligente e sabe se tem 28, 30 ou 31 dias)
    const dataInicio = `${filtroMes}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${filtroMes}-${ultimoDia}`;

    const { data: despesas, error } = await supabase
      .from("despesas")
      .select("descricao, valor, data, categoria")
      .gte("data", dataInicio) // Data Maior ou Igual ao 1º dia
      .lte("data", dataFim); // Data Menor ou Igual ao último dia

    if (error) throw error;

    // 2. Cálculos Matemáticos Base
    const totalFaturado = mensalidades
      .filter((m) => m.estado === "Pago")
      .reduce((soma, m) => soma + extrairPreco(m.valor), 0);

    const totalDespesas = (despesas || []).reduce(
      (soma, d) => soma + parseFloat(d.valor),
      0,
    );

    const saldoLiquido = totalFaturado - totalDespesas;

    // 3. Iniciar o Documento PDF
    const doc = new window.jspdf.jsPDF();
    doc.setFontSize(18);
    doc.text("Bogas Team Fight Center", 14, 20);
    doc.setFontSize(12);
    doc.text(titulo || "Relatório Financeiro", 14, 30);
    doc.text(
      `Mês de Referência: ${filtroMes} | Gerado a: ${new Date().toLocaleDateString()}`,
      14,
      38,
    );

    // 4. TABELA 1: ENTRADAS (Mensalidades e Aulas)
    const rowsReceitas = mensalidades.map((m) => [
      m.mes_ano,
      formatarNomeCurto(m.socios?.nome),
      m.tipo,
      m.socios?.modalidade || "-",
      `${m.valor} €`,
      m.estado,
    ]);

    doc.setFontSize(14);
    doc.setTextColor(37, 211, 102); // Título a Verde
    doc.text("Entradas (Receitas)", 14, 48);

    doc.autoTable({
      startY: 52,
      head: [["Mês", "Sócio", "Tipo", "Modalidade", "Valor", "Estado"]],
      body: rowsReceitas,
      theme: "striped",
      headStyles: { fillColor: [37, 211, 102] }, // Cabeçalho Verde Bogas
      styles: { font: "helvetica", fontSize: 10 },
      margin: { bottom: 20 },
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    // 5. TABELA 2: SAÍDAS (Despesas) - Só desenha se houver despesas neste mês!
    if (despesas && despesas.length > 0) {
      // Se não houver espaço na página para a tabela, cria página nova
      if (finalY > 230) {
        doc.addPage();
        finalY = 20;
      }

      const rowsDespesas = despesas.map((d) => [
        d.data.split("-").reverse().join("/"),
        d.descricao,
        d.categoria,
        `${parseFloat(d.valor).toFixed(2)} €`,
      ]);

      doc.setFontSize(14);
      doc.setTextColor(255, 77, 77); // Título a Vermelho
      doc.text("Saídas (Despesas)", 14, finalY);

      doc.autoTable({
        startY: finalY + 5,
        head: [["Data", "Descrição", "Categoria", "Valor"]],
        body: rowsDespesas,
        theme: "striped",
        headStyles: { fillColor: [255, 77, 77] }, // Cabeçalho Vermelho Perigo
        styles: { font: "helvetica", fontSize: 10 },
      });
      finalY = doc.lastAutoTable.finalY + 15;
    }

    // 6. CAIXA FINAL: RESUMO DO MÊS
    // Verifica se a caixa de resumo cabe no fundo da folha, senão muda de folha
    if (finalY > 240) {
      doc.addPage();
      finalY = 20;
    }

    // Desenhar um retângulo cinza claro para destacar o resumo
    doc.setFillColor(240, 240, 240);
    doc.rect(14, finalY, 180, 38, "F");

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text("BALANÇO FINAL DO MÊS", 20, finalY + 8);

    doc.setFont("helvetica", "normal");
    doc.text(
      `Total Faturado (Bruto): ${totalFaturado.toFixed(2)} €`,
      20,
      finalY + 16,
    );
    doc.text(
      `Total Gasto (Despesas): ${totalDespesas.toFixed(2)} €`,
      20,
      finalY + 22,
    );

    // O VEREDICTO (Saldo Líquido)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    if (saldoLiquido >= 0) {
      doc.setTextColor(37, 211, 102); // Verde se houver lucro!
    } else {
      doc.setTextColor(255, 77, 77); // Vermelho se houver prejuízo
    }
    doc.text(
      `SALDO LÍQUIDO (Caixa): ${saldoLiquido.toFixed(2)} €`,
      20,
      finalY + 32,
    );

    doc.save(`Fluxo_Caixa_BogasTeam_${filtroMes}.pdf`);
  } catch (e) {
    console.error("Erro PDF:", e);
    alert("Erro ao gerar o Relatório Financeiro.");
  }
}
