/* JS/pdfManager.js - GESTOR FINANCEIRO COMPLETO E BLINDADO (Agora com Filtro de Rendimentos) */
import { formatarNomeCurto } from "./helpers.js";
import { supabase } from "./supabase.js";

// 🥊 Função auxiliar de Limpeza Matemática
function limparValorNumerico(valor) {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") return valor;
  const formatado = String(valor)
    .replace(/€/g, "")
    .replace(/ /g, "")
    .replace(",", ".");
  return parseFloat(formatado) || 0;
}

// ============================================================================
// 🥊 1. FUNÇÃO BASE DE TABELAS
// ============================================================================
export function exportarPDF(titulo, rows, colunas, filename, footerRow = null) {
  try {
    const doc = new window.jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.text("Bogas Team Fight Center", 14, 20);
    doc.setFontSize(12);
    doc.text(titulo || "Documento", 14, 30);

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Data de Emissão: ${new Date().toLocaleDateString()}`,
      pageWidth - 14,
      38,
      { align: "right" },
    );

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

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
    } else if (window.jspdf?.jsPDF?.autoTable) {
      window.jspdf.jsPDF.autoTable(doc, opcoesTabela);
    }

    doc.save(filename);
  } catch (e) {
    console.error("Erro PDF:", e);
    alert("Erro ao gerar PDF.");
  }
}

// ============================================================================
// 🥊 2. ESPECIALISTA NA LISTA DE SÓCIOS
// ============================================================================
export function exportarGuerreirosPDF(guerreiros) {
  const rows = guerreiros.map((s) => [
    s.nome ? formatarNomeCurto(s.nome) : "Desconhecido",
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

// ============================================================================
// 🥊 3. ESPECIALISTA FINANCEIRO (Mês Extenso + Parcerias + Despesas)
// ============================================================================
export async function exportarMensalidadesPDF(lista, titulo, mesReferencia) {
  if (!lista || lista.length === 0) {
    alert("Sem dados para exportar neste mês.");
    return;
  }

  if (!mesReferencia) {
    const hoje = new Date();
    mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  }

  try {
    const mesesPT = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];

    const [ano, mesNum] = mesReferencia.split("-");
    const nomeMesExtenso = `${mesesPT[parseInt(mesNum) - 1] || "Mês Desconhecido"} de ${ano || "Ano Desconhecido"}`;

    const doc = new window.jspdf.jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    const ultimoDia = new Date(parseInt(ano), parseInt(mesNum), 0).getDate();
    const dataInicio = `${mesReferencia}-01`;
    const dataFim = `${mesReferencia}-${ultimoDia}`;

    const { data: despesasMes, error: erroDespesas } = await supabase
      .from("despesas")
      .select("*")
      .filter("data", "gte", dataInicio)
      .filter("data", "lte", dataFim);

    if (erroDespesas) {
      console.warn("Aviso: Falha ao procurar despesas do mês.", erroDespesas);
    }

    const desenharTabela = (opcoes) => {
      if (typeof doc.autoTable === "function") {
        doc.autoTable(opcoes);
      } else {
        window.jspdf.jsPDF.autoTable(doc, opcoes);
      }
    };

    // 🥊 MAGIA AQUI: Agora ele separa como "Parceria" se o nome for Gym/Parceria OU se o Tipo for "Rendimento"
    const parcerias = lista.filter((m) => {
      const nomeUpper = (m.socios?.nome || "").toUpperCase();
      const tipoUpper = (m.tipo || "").toUpperCase();

      return (
        nomeUpper.includes("GYM") ||
        nomeUpper.includes("PARCERIA") ||
        tipoUpper.includes("RENDIMENTO")
      );
    });

    // Os restantes são os atletas normais do Bogas Team
    const atletas = lista.filter((m) => !parcerias.includes(m));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(
      `BOGAS TEAM - RELATÓRIO DE ${nomeMesExtenso.toUpperCase()}`,
      pageWidth / 2,
      15,
      { align: "center" },
    );

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Data de Emissão: ${new Date().toLocaleDateString()}`,
      pageWidth - 14,
      22,
      { align: "right" },
    );

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);

    let finalY = 30;

    // --- TABELA ATLETAS (VERDE BOGAS ORIGINAL) ---
    if (atletas.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 0);
      doc.text("RECEITAS: ATLETAS", 14, finalY);
      doc.setTextColor(0, 0, 0);
      desenharTabela({
        startY: finalY + 2,
        head: [["Atleta", "Tipo", "Estado", "Valor"]],
        body: atletas.map((m) => [
          m.socios?.nome || "N/A",
          m.tipo || "Mensalidade",
          m.estado || "-",
          `${limparValorNumerico(m.valor).toFixed(2)}€`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [37, 211, 102] },
        margin: { left: 14, right: 14 },
      });
      finalY = doc.lastAutoTable.finalY + 10;
    }

    // --- TABELA PARCERIAS / RENDIMENTOS (VERDE ESCURO) ---
    if (parcerias.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 128, 0);
      doc.text("RECEITAS: PARCERIAS E RENDIMENTOS EXTERNOS", 14, finalY);
      doc.setTextColor(0, 0, 0);
      desenharTabela({
        startY: finalY + 2,
        head: [["Entidade / Origem", "Descrição", "Estado", "Valor"]],
        body: parcerias.map((m) => [
          m.socios?.nome || "Entidade Externa",
          m.tipo || "Prestação de Serviços", // Se for "Rendimento", vai aparecer a palavra Rendimento aqui!
          m.estado || "-",
          `${limparValorNumerico(m.valor).toFixed(2)}€`,
        ]),
        theme: "grid",
        headStyles: { fillColor: [0, 150, 0] },
        margin: { left: 14, right: 14 },
      });
      finalY = doc.lastAutoTable.finalY + 10;
    }

    // --- TABELA DESPESAS (VERMELHO) ---
    let totalDespesas = 0;
    if (despesasMes && despesasMes.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(200, 0, 0);
      doc.text("SAÍDAS: DESPESAS E CUSTOS", 14, finalY);
      doc.setTextColor(0, 0, 0);
      desenharTabela({
        startY: finalY + 2,
        head: [["Data", "Descrição", "Categoria", "Valor"]],
        body: despesasMes.map((d) => {
          totalDespesas += limparValorNumerico(d.valor);
          return [
            d.data ? d.data.split("-").reverse().join("/") : "-",
            d.descricao || "-",
            d.categoria || "-",
            `${limparValorNumerico(d.valor).toFixed(2)}€`,
          ];
        }),
        theme: "striped",
        headStyles: { fillColor: [200, 0, 0] },
        margin: { left: 14, right: 14 },
      });
      finalY = doc.lastAutoTable.finalY + 10;
    }

    // --- CÁLCULOS E RODAPÉ ---
    const totalAtletas = atletas.reduce(
      (acc, cur) => acc + limparValorNumerico(cur.valor),
      0,
    );
    const totalParcerias = parcerias.reduce(
      (acc, cur) => acc + limparValorNumerico(cur.valor),
      0,
    );
    const totalReceitas = totalAtletas + totalParcerias;
    const balancoFinal = totalReceitas - totalDespesas;

    if (finalY > 240) doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.line(14, finalY, pageWidth - 14, finalY);
    finalY += 8;

    doc.setFontSize(11);
    doc.text(`(+) Total Receitas (${nomeMesExtenso}):`, 14, finalY);
    doc.text(`${totalReceitas.toFixed(2)}€`, pageWidth - 40, finalY, {
      align: "right",
    });

    finalY += 6;
    doc.text(`(-) Total Saídas (Despesas):`, 14, finalY);
    doc.text(`${totalDespesas.toFixed(2)}€`, pageWidth - 40, finalY, {
      align: "right",
    });

    finalY += 10;
    doc.setFontSize(14);

    if (balancoFinal >= 0) {
      doc.setTextColor(0, 120, 0);
    } else {
      doc.setTextColor(200, 0, 0);
    }

    doc.text(`LUCRO LÍQUIDO MENSAL:`, 14, finalY);
    doc.text(`${balancoFinal.toFixed(2)}€`, pageWidth - 40, finalY, {
      align: "right",
    });

    const nomeFicheiro = `Financeiro_${nomeMesExtenso.replace(/ /g, "_")}.pdf`;
    doc.save(nomeFicheiro);
  } catch (erro) {
    console.error("Erro PDF:", erro);
    alert("Erro ao processar balanço: " + erro.message);
  }
}
