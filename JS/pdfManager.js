/* JS/pdfManager.js - GESTOR FINANCEIRO COMPLETO E BLINDADO (Agora com Filtro de Rendimentos) */
import { formatarNomeCurto } from "./helpers.js";
import { supabase } from "./supabase.js";
import { mostrarAviso } from "./toast.js";

// O jsPDF (~400 KB) só é descarregado quando o treinador exporta um PDF,
// em vez de atrasar a abertura do dashboard.
const SCRIPTS_PDF = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js",
];
let carregamentoPDF = null;

function carregarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Não foi possível carregar " + src));
    document.head.appendChild(s);
  });
}

export function carregarJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve();
  if (!carregamentoPDF) {
    carregamentoPDF = SCRIPTS_PDF.reduce(
      (p, src) => p.then(() => carregarScript(src)),
      Promise.resolve(),
    )
      .then(() => {
        window.jsPDF = window.jspdf.jsPDF;
      })
      .catch((e) => {
        carregamentoPDF = null;
        throw e;
      });
  }
  return carregamentoPDF;
}

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
export async function exportarPDF(titulo, rows, colunas, filename, footerRow = null) {
  try {
    await carregarJsPDF();
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
    mostrarAviso("Erro", "Erro ao gerar PDF.", "erro");
  }
}

// ============================================================================
// 🥊 2. ESPECIALISTA NA LISTA DE SÓCIOS
// ============================================================================
export async function exportarGuerreirosPDF(guerreiros) {
  const rows = guerreiros.map((s) => [
    s.nome ? formatarNomeCurto(s.nome) : "Desconhecido",
    s.modalidade || "-",
    s.graduacao || "-",
    s.federacao || "Não Regularizada",
    s.estado || "Ativo",
  ]);

  await exportarPDF(
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
    mostrarAviso("Sem dados", "Sem dados para exportar neste mês.", "erro");
    return;
  }

  if (!mesReferencia) {
    const hoje = new Date();
    mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  }

  try {
    await carregarJsPDF();
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

    // Sem despesas o "lucro líquido" sairia errado: é melhor falhar e avisar.
    if (erroDespesas) throw erroDespesas;

    // Vendas de material do mês (as anuladas não contam).
    const { data: vendasMesBrutas, error: erroVendas } = await supabase
      .from("vendas")
      .select("data, cliente_nome, estado, total, custo_total, venda_itens(produto_nome, variante_nome, quantidade)")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .neq("estado", "Anulada")
      .order("data");
    // Se o módulo de vendas ainda não existir na BD (migração 03 por correr), o relatório sai sem vendas.
    const moduloVendasEmFalta =
      erroVendas && (["PGRST205", "42P01"].includes(erroVendas.code) || /does not exist|Could not find/.test(erroVendas.message || ""));
    if (erroVendas && !moduloVendasEmFalta) throw erroVendas;
    const vendasMes = vendasMesBrutas || [];

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

    // --- TABELA VENDAS DE MATERIAL (AZUL) ---
    let lucroVendasPagas = 0;
    let receitaVendas = 0;
    if (vendasMes.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 90, 160);
      doc.text("RECEITAS: VENDAS DE MATERIAL", 14, finalY);
      doc.setTextColor(0, 0, 0);
      desenharTabela({
        startY: finalY + 2,
        head: [["Data", "Cliente", "Artigos", "Estado", "Total", "Lucro"]],
        body: vendasMes.map((v) => {
          const total = limparValorNumerico(v.total);
          const lucro = total - limparValorNumerico(v.custo_total);
          receitaVendas += total;
          if (v.estado === "Paga") lucroVendasPagas += lucro;
          return [
            v.data ? v.data.split("-").reverse().join("/") : "-",
            v.cliente_nome || "-",
            (v.venda_itens || [])
              .map((i) => `${i.quantidade}x ${i.produto_nome}${i.variante_nome && i.variante_nome !== "Único" ? ` (${i.variante_nome})` : ""}`)
              .join(", "),
            v.estado || "-",
            `${total.toFixed(2)}€`,
            `${lucro.toFixed(2)}€`,
          ];
        }),
        theme: "striped",
        headStyles: { fillColor: [0, 110, 190] },
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
    // Das vendas entra o LUCRO (venda - custo do material) das vendas já pagas.
    const balancoFinal = totalReceitas + lucroVendasPagas - totalDespesas;

    if (finalY > 240) doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.line(14, finalY, pageWidth - 14, finalY);
    finalY += 8;

    doc.setFontSize(11);
    doc.text(`(+) Total Receitas (${nomeMesExtenso}):`, 14, finalY);
    doc.text(`${totalReceitas.toFixed(2)}€`, pageWidth - 40, finalY, {
      align: "right",
    });

    if (vendasMes.length > 0) {
      finalY += 6;
      doc.text(`(+) Lucro das Vendas pagas (vendido: ${receitaVendas.toFixed(2)}€):`, 14, finalY);
      doc.text(`${lucroVendasPagas.toFixed(2)}€`, pageWidth - 40, finalY, {
        align: "right",
      });
    }

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
    mostrarAviso("Erro", "Erro ao processar balanço: " + erro.message, "erro");
  }
}
