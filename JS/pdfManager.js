/* JS/pdfManager.js - GESTOR ESPECIALIZADO DE PDFs */
import { formatarNomeCurto, extrairPreco } from "./helpers.js";

// 🥊 Função Base de Geração (Mantida com o teu design)
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
      foot: footerRow ? [footerRow] : null, // O teu rodapé escuro!
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

// 🥊 Especialista na Lista de Sócios
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

// 🥊 Especialista nas Mensalidades (Usa o teu extrairPreco!)
export function exportarMensalidadesPDF(mensalidades, titulo, filtroMes) {
  const rows = mensalidades.map((m) => [
    m.mes_ano,
    formatarNomeCurto(m.socios?.nome),
    m.tipo,
    m.socios?.modalidade,
    `${m.valor} €`,
    m.estado,
  ]);

  // 🥊 O Golpe Perfeito: Usamos o teu extrairPreco para garantir que a soma nunca dá erro (NaN)
  const totalFaturado = mensalidades
    .filter((m) => m.estado === "Pago")
    .reduce((soma, m) => soma + extrairPreco(m.valor), 0);

  // A linha do rodapé com o fundo escuro
  const linhaRodape = [
    "",
    "",
    "",
    "TOTAL FATURADO:",
    `${totalFaturado.toFixed(2)} €`,
    "",
  ];

  exportarPDF(
    titulo,
    rows,
    ["Mês", "Sócio", "Tipo", "Modalidade", "Valor", "Estado"],
    `Financeiro_${filtroMes}.pdf`,
    linhaRodape,
  );
}
