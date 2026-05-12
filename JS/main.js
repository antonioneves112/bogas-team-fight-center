/* JS/main.js - O CÉREBRO DA APLICAÇÃO (Versão Blindada 2.0 - c/ Debounce) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto, extrairPreco, debounce } from "./helpers.js"; // 🥊 IMPORT DO DEBOUNCE UNIFICADO
import { inicializarTabs, inicializarFechoModais } from "./ui.js";
import { executarLogout } from "./auth.js";
import {
  carregarGuerreiros,
  renderizarTabelaSocios,
  initSociosEvents,
  renderizarTabelaInativos,
} from "./socios.js";
import {
  carregarMensalidades,
  renderizarTabelaMensalidades,
  initMensalidadesEvents,
} from "./mensalidades.js";
import {
  exportarGuerreirosPDF,
  exportarMensalidadesPDF,
} from "./pdfManager.js";

// =========================================================================
// 🥊 FUNÇÃO GLOBAL DE TOAST (AVISOS VISUAIS DE ELITE)
// =========================================================================
export function mostrarAviso(titulo, mensagem, tipo = "sucesso") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  const icone = tipo === "sucesso" ? "bx-check-circle" : "bx-error-circle";

  toast.innerHTML = `
    <i class='bx ${icone}'></i>
    <div class="toast-content">
      <h4>${titulo}</h4>
      <p>${mensagem}</p>
    </div>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

if (window.jspdf && window.jspdf.jsPDF && !window.jsPDF) {
  window.jsPDF = window.jspdf.jsPDF;
}

// =========================================================================
// 🥊 ARRANQUE DO MOTOR (ESPERA QUE O ECRÃ CARREGUE)
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  // 1. VERIFICAÇÃO DE SESSÃO REAL (BLINDAGEM)
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.replace("login.html");
    return;
  }

  // 2. RECUPERA O NOME DO TREINADOR LOGADO
  state.treinadorAtual =
    localStorage.getItem("bogas_treinador_nome") || "Bogas";

  // 3. INICIALIZAR EVENTOS E MÓDULOS DE UI
  inicializarTabs();
  inicializarFechoModais();
  initSociosEvents();
  initMensalidadesEvents();
  initAulasEvents();

  configurarAprovacaoAula();
  configurarPagamentoDiretoAula();
  configurarRegistoDespesas();

  // =======================================================================
  // CONTROLO DE TABS (INATIVOS) E MODAIS
  // =======================================================================
  const btnParceirosAdmin = document.getElementById("btnParceirosAdmin");
  if (btnParceirosAdmin) {
    btnParceirosAdmin.addEventListener("click", () => {
      document.querySelectorAll(".tab-content").forEach((t) => {
        t.classList.add("hidden");
        t.classList.remove("active");
      });

      document
        .querySelectorAll(".tab-btn")
        .forEach((t) => t.classList.remove("active"));

      const viewInativos = document.getElementById("view-inativos");
      if (viewInativos) {
        viewInativos.classList.remove("hidden");
        viewInativos.classList.add("active");
      }

      if (state.inativosAtuais) renderizarTabelaInativos(state.inativosAtuais);
    });
  }

  const modalBroadcast = document.getElementById("modalBroadcast");
  document
    .getElementById("btnAbrirModalBroadcast")
    ?.addEventListener("click", () =>
      modalBroadcast?.classList.remove("hidden"),
    );
  document
    .getElementById("btnFecharModalBroadcast")
    ?.addEventListener("click", () => modalBroadcast?.classList.add("hidden"));

  // =======================================================================
  // CONTROLO DE DATA, ARRANQUE DE DADOS E ESTATÍSTICAS
  // =======================================================================
  const filtroMes = document.getElementById("filtroMesMensalidade");
  const tituloMensalidade = document.getElementById("tituloMensalidade");
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

  function atualizarTituloMes() {
    const valor = filtroMes?.value;
    if (valor && tituloMensalidade) {
      const [ano, mesNum] = valor.split("-");
      tituloMensalidade.innerText = `Controlo de Mensalidades ${mesesPT[parseInt(mesNum) - 1]}`;
    }
  }

  const hojeConfig = new Date();
  if (filtroMes) {
    filtroMes.value = `${hojeConfig.getFullYear()}-${String(hojeConfig.getMonth() + 1).padStart(2, "0")}`;
    atualizarTituloMes();

    filtroMes.addEventListener("change", () => {
      atualizarTituloMes();
      carregarGuerreiros();
      carregarMensalidades();
      carregarAulasParticulares();
    });
  }

  // CARREGAMENTO INICIAL
  carregarGuerreiros();
  carregarMensalidades();
  carregarAulasParticulares();

  // =======================================================================
  // ATALHOS DE CARDS (DASHBOARD)
  // =======================================================================
  const cardPendentes = document.getElementById("cardPendentes");
  if (cardPendentes) {
    cardPendentes.addEventListener("click", () => {
      document.querySelector('.tab-btn[data-target="view-socios"]')?.click();

      // 🥊 NOVA LÓGICA: Sincronizada com o contador inteligente!
      const faturasMes = state.mensalidadesAtuais || [];
      const idsComDivida = faturasMes
        .filter((m) => m.estado === "Pendente")
        .map((m) => m.socio_id);
      const idsFaturados = faturasMes.map((m) => m.socio_id);

      const pendentes = state.guerreirosAtuais.filter((s) => {
        if (s.estado === "Inativo") return false;

        // Tem alguma fatura pendente neste mês (Mensalidade ou PT)?
        const temFaturaPendente = idsComDivida.includes(s.id);

        // Ou ainda nem sequer foi faturado (e é um atleta ativo)?
        const naoTemNenhumaFatura = !idsFaturados.includes(s.id);

        return temFaturaPendente || naoTemNenhumaFatura;
      });

      renderizarTabelaSocios(pendentes);
    });
  }

  const cardTotalSocios = document.getElementById("cardTotalSocios");
  if (cardTotalSocios) {
    cardTotalSocios.addEventListener("click", () => {
      document.querySelector('.tab-btn[data-target="view-socios"]')?.click();
      renderizarTabelaSocios(state.guerreirosAtuais);
    });
  }

  // =======================================================================
  // MOTOR DE TRANSMISSÃO GLOBAL (METRALHADORA PUSH)
  // =======================================================================
  const btnAvisar = document.getElementById("btnAvisarGeral");
  if (btnAvisar) {
    btnAvisar.addEventListener("click", async () => {
      const titulo =
        document.getElementById("tituloNotificacao").value.trim() ||
        "Bogas Team Fight Center";
      const mensagem = document
        .getElementById("mensagemNotificacao")
        .value.trim();

      if (!mensagem) {
        mostrarAviso(
          "Atenção",
          "Mestre, a mensagem não pode ir vazia!",
          "erro",
        );
        return;
      }

      const textoOriginal = btnAvisar.innerHTML;
      btnAvisar.innerHTML =
        "A disparar... <i class='bx bx-loader-alt bx-spin'></i>";
      btnAvisar.disabled = true;

      try {
        const { data, error } = await supabase.functions.invoke(
          "notificar-todos",
          {
            body: { titulo: titulo, mensagem: mensagem },
          },
        );
        if (error) throw error;

        const atletasAtivos = state.guerreirosAtuais.filter(
          (s) => s.estado !== "Inativo",
        );
        if (atletasAtivos.length > 0) {
          const novasNotificacoes = atletasAtivos.map((atleta) => ({
            socio_id: atleta.id,
            titulo: titulo,
            mensagem: mensagem,
            lida: false,
          }));
          await supabase.from("notificacoes").insert(novasNotificacoes);
        }

        mostrarAviso(
          "Bogas Team",
          `Nocaute perfeito! ${data?.mensagem || "Alerta enviado!"}`,
          "sucesso",
        );
        document.getElementById("tituloNotificacao").value = "";
        document.getElementById("mensagemNotificacao").value = "";
        modalBroadcast?.classList.add("hidden");
      } catch (erro) {
        mostrarAviso(
          "Erro no Disparo",
          `O golpe bateu na guarda: ${erro.message || "Erro desconhecido."}`,
          "erro",
        );
      } finally {
        btnAvisar.innerHTML = textoOriginal;
        btnAvisar.disabled = false;
      }
    });
  }

  // =======================================================================
  // PESQUISAS DINÂMICAS NAS TABELAS (Agora com 🥊 DEBOUNCE Otimizado)
  // =======================================================================
  const filtroNome = document.getElementById("filtroNomeSocio");
  const btnLimparSocio = document.getElementById("limparSocio");

  if (filtroNome) {
    // 1. O Debounce: O trabalho pesado de filtrar e renderizar espera 300ms
    const renderizaFiltroSocio = debounce((termo) => {
      const filtrados = state.guerreirosAtuais.filter((s) =>
        s.nome.toLowerCase().includes(termo),
      );
      renderizarTabelaSocios(filtrados);
    }, 300);

    // 2. O Evento: Mostra logo o botão X e ativa o debounce
    filtroNome.addEventListener("input", (e) => {
      const termo = e.target.value.toLowerCase();
      if (btnLimparSocio)
        btnLimparSocio.style.display = termo.length > 0 ? "block" : "none";
      renderizaFiltroSocio(termo);
    });

    btnLimparSocio?.addEventListener("click", () => {
      filtroNome.value = "";
      btnLimparSocio.style.display = "none";
      renderizarTabelaSocios(state.guerreirosAtuais);
      filtroNome.focus();
    });

    document.addEventListener("click", (e) => {
      if (filtroNome.value.trim() !== "") {
        const isClickInside =
          filtroNome.contains(e.target) || btnLimparSocio?.contains(e.target);
        if (!isClickInside) {
          filtroNome.value = "";
          if (btnLimparSocio) btnLimparSocio.style.display = "none";
          renderizarTabelaSocios(state.guerreirosAtuais);
        }
      }
    });
  }

  const filtroInativo = document.getElementById("filtroNomeInativo");
  const btnLimparInativo = document.getElementById("limparInativo");

  if (filtroInativo) {
    const renderizaFiltroInativo = debounce((termo) => {
      const filtrados = (state.inativosAtuais || []).filter((s) =>
        s.nome.toLowerCase().includes(termo),
      );
      renderizarTabelaInativos(filtrados);
    }, 300);

    filtroInativo.addEventListener("input", (e) => {
      const termo = e.target.value.toLowerCase();
      if (btnLimparInativo)
        btnLimparInativo.style.display = termo.length > 0 ? "block" : "none";
      renderizaFiltroInativo(termo);
    });

    btnLimparInativo?.addEventListener("click", () => {
      filtroInativo.value = "";
      btnLimparInativo.style.display = "none";
      renderizarTabelaInativos(state.inativosAtuais);
    });

    document.addEventListener("click", (e) => {
      if (filtroInativo.value.trim() !== "") {
        const isClickInside =
          filtroInativo.contains(e.target) ||
          btnLimparInativo?.contains(e.target);
        if (!isClickInside) {
          filtroInativo.value = "";
          if (btnLimparInativo) btnLimparInativo.style.display = "none";
          renderizarTabelaInativos(state.inativosAtuais);
        }
      }
    });
  }

  const filtroNomeMensalidade = document.getElementById(
    "filtroNomeMensalidade",
  );
  const btnLimparMensalidade = document.getElementById("limparMensalidade");

  if (filtroNomeMensalidade) {
    const renderizaFiltroMensalidade = debounce((termo) => {
      const filtrados = state.mensalidadesAtuais.filter((m) =>
        (m.socios?.nome || "").toLowerCase().includes(termo),
      );
      renderizarTabelaMensalidades(filtrados);
    }, 300);

    filtroNomeMensalidade.addEventListener("input", (e) => {
      const termo = e.target.value.toLowerCase();
      if (btnLimparMensalidade)
        btnLimparMensalidade.style.display =
          termo.length > 0 ? "block" : "none";
      renderizaFiltroMensalidade(termo);
    });

    btnLimparMensalidade?.addEventListener("click", () => {
      filtroNomeMensalidade.value = "";
      btnLimparMensalidade.style.display = "none";
      renderizarTabelaMensalidades(state.mensalidadesAtuais);
    });

    document.addEventListener("click", (e) => {
      if (filtroNomeMensalidade.value.trim() !== "") {
        const isClickInside =
          filtroNomeMensalidade.contains(e.target) ||
          btnLimparMensalidade?.contains(e.target);
        if (!isClickInside) {
          filtroNomeMensalidade.value = "";
          if (btnLimparMensalidade) btnLimparMensalidade.style.display = "none";
          renderizarTabelaMensalidades(state.mensalidadesAtuais);
        }
      }
    });
  }

  // =======================================================================
  // EXPORTAÇÃO PDF
  // =======================================================================
  document
    .getElementById("btnExportarSociosPDF")
    ?.addEventListener("click", () => {
      exportarGuerreirosPDF(state.guerreirosAtuais);
    });

  document.getElementById("btnExportarPDF")?.addEventListener("click", () => {
    exportarMensalidadesPDF(
      state.mensalidadesAtuais,
      tituloMensalidade?.innerText,
      filtroMes?.value,
    );
  });

  // =======================================================================
  // LOGOUT DO TREINADOR
  // =======================================================================
  const btnLogout = document.getElementById("btnLogout");
  const modalConfirmLogout = document.getElementById("modalConfirmLogout");

  btnLogout?.addEventListener("click", () =>
    modalConfirmLogout?.classList.remove("hidden"),
  );
  document
    .getElementById("btnCancelarLogout")
    ?.addEventListener("click", () =>
      modalConfirmLogout?.classList.add("hidden"),
    );

  document
    .getElementById("btnConfirmarLogout")
    ?.addEventListener("click", async (e) => {
      const btnConfirma = e.currentTarget;
      btnConfirma.innerHTML =
        "A sair... <i class='bx bx-loader-alt bx-spin'></i>";
      btnConfirma.disabled = true;
      await executarLogout();
    });
});

// =========================================================================
// 🥊 FUNÇÕES DE AULAS E DESPESAS (Declaradas fora para estarem disponíveis)
// =========================================================================

function configurarAprovacaoAula() {
  const formAprovar = document.getElementById("formAprovarAula");
  const modalAprovar = document.getElementById("modalAprovarAula");
  const btnFecharAprovar = document.getElementById("btnFecharModalAprovar");

  btnFecharAprovar?.addEventListener("click", () => {
    modalAprovar.classList.add("hidden");
    formAprovar.reset();
  });

  formAprovar?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const aulaId = document.getElementById("hiddenAulaId").value;
    const socioId = document.getElementById("hiddenSocioIdAula").value;
    const dataAulaDb = document.getElementById("hiddenDataAula").value;

    let valorDigitado = document.getElementById("valorAulaParticular").value;
    const valorLimpo = parseFloat(
      valorDigitado.replace("€", "").replace(",", ".").trim(),
    );
    const mesAnoFormatado = dataAulaDb.substring(0, 7);

    const btnConfirmar = document.getElementById("btnConfirmarAprovacao");
    const textoOriginal = btnConfirmar.innerHTML;
    btnConfirmar.innerHTML =
      "A processar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirmar.disabled = true;

    try {
      const { error: erroAula } = await supabase
        .from("aulas_particulares")
        .update({ estado: "Aceite", valor: valorLimpo })
        .eq("id", aulaId);
      if (erroAula) throw erroAula;

      const { error: erroFatura } = await supabase.from("mensalidades").insert([
        {
          socio_id: socioId,
          mes_ano: mesAnoFormatado,
          tipo: "Aula Particular",
          estado: "Pendente",
          valor: valorLimpo,
        },
      ]);
      if (erroFatura) throw erroFatura;

      const dataLegivel = dataAulaDb.split("-").reverse().join("/");
      const tituloNotif = "Aula Aprovada ✅";
      const mensagemNotif = `O Mestre aprovou a tua aula particular do dia ${dataLegivel}. Foi adicionado um pagamento pendente de ${valorLimpo}€ ao teu portal.`;

      await supabase.from("notificacoes").insert([
        {
          socio_id: socioId,
          titulo: tituloNotif,
          mensagem: mensagemNotif,
          lida: false,
        },
      ]);

      try {
        await supabase.functions.invoke("notificar-alvo", {
          body: {
            socio_id: parseInt(socioId),
            titulo: tituloNotif,
            mensagem: mensagemNotif,
          },
        });
      } catch (erroPush) {
        console.warn("Aviso Push:", erroPush);
      }

      mostrarAviso(
        "Nocaute Técnico",
        "Aula aprovada e faturação lançada com sucesso!",
        "sucesso",
      );
      modalAprovar.classList.add("hidden");
      formAprovar.reset();

      await carregarAulasParticulares();
      await carregarMensalidades();
      await atualizarBadgeAulasPendentes();
    } catch (erro) {
      mostrarAviso("Erro", "O golpe falhou: " + erro.message, "erro");
    } finally {
      btnConfirmar.innerHTML = textoOriginal;
      btnConfirmar.disabled = false;
    }
  });
}

export async function carregarAulasParticulares() {
  const tabela = document.getElementById("tabelaAulasParticulares");
  if (!tabela) return;
  tabela.innerHTML =
    '<tr><td colspan="7">A procurar pedidos... <i class="bx bx-loader-alt bx-spin"></i></td></tr>';

  try {
    const { data: pedidos, error } = await supabase
      .from("aulas_particulares")
      .select(`id, data_aula, hora_aula, socio_id, estado, valor, pago`)
      .order("data_aula", { ascending: false });
    if (error) throw error;

    const { data: listaSocios, error: errSocios } = await supabase
      .from("socios")
      .select("id, nome");
    if (errSocios) throw errSocios;

    state.aulasParticulares = pedidos.map((pedido) => {
      const socioEncontrado = listaSocios.find((s) => s.id === pedido.socio_id);
      return {
        ...pedido,
        socios: {
          nome: socioEncontrado ? socioEncontrado.nome : "Atleta Desconhecido",
        },
      };
    });

    renderizarTabelaAulas(state.aulasParticulares);
  } catch (err) {
    tabela.innerHTML =
      '<tr><td colspan="7" style="color: #ff4d4d; text-align: center;">Erro ao carregar pedidos.</td></tr>';
  }
}

// =========================================================================
// 🥊 INÍCIO DA ZONA DE ALTERAÇÕES - RENDERIZAÇÃO E EVENTOS DE AULAS
// =========================================================================
export function renderizarTabelaAulas(lista) {
  const tabela = document.getElementById("tabelaAulasParticulares");
  if (!tabela) return;

  if (!lista || lista.length === 0) {
    tabela.innerHTML =
      '<tr><td colspan="7" class="table-empty-state">Sem pedidos.</td></tr>';
    return;
  }

  tabela.innerHTML = lista
    .map((p) => {
      const dataF = p.data_aula.split("-").reverse().join("/");
      const valorExibido = p.valor ? `${p.valor}€` : "A definir";
      const badgeClass =
        p.estado === "Aceite"
          ? "badge-ativo"
          : p.estado === "Recusada"
            ? "badge-inativo"
            : "badge-pendente";
      const badgePagoClass = p.pago ? "badge-ativo" : "badge-inativo";

      const nomeCurto = formatarNomeCurto(p.socios.nome).toUpperCase();

      // 🥊 BOTÕES BASE (Sempre visíveis em todas as aulas: Editar e Eliminar)
      const btnAcoesBase = `
        <button class="btn-acao btn-edit btn-edit-aula" data-id="${p.id}" title="Editar Pedido"><i class='bx bx-edit'></i></button>
        <button class="btn-acao btn-delete btn-delete-aula" data-id="${p.id}" title="Eliminar Aula"><i class='bx bx-trash'></i></button>
      `;

      // 🥊 BOTÕES CONTEXTUAIS (Aprovar, Recusar, Faturar)
      let botoesContexto = "";
      if (p.estado === "Pendente") {
        botoesContexto = `
        <button class="btn-acao btn-edit btn-aceitar-aula" data-id="${p.id}" data-socio="${p.socio_id}" data-datadb="${p.data_aula}" title="Aprovar Aula"><i class='bx bx-check'></i></button>
        <button class="btn-acao btn-delete btn-recusar-aula" data-id="${p.id}" data-socio="${p.socio_id}" data-data="${dataF}" title="Recusar Aula"><i class='bx bx-x'></i></button>
      `;
      } else if (p.estado === "Aceite" && !p.pago) {
        botoesContexto = `<button class="btn-tatico btn-small btn-faturar-aula-direto" data-id="${p.id}" data-socio="${p.socio_id}" data-nome="${p.socios.nome}" data-valor="${p.valor}" data-data="${dataF}" data-datadb="${p.data_aula}"><i class='bx bx-euro'></i> FATURAR</button>`;
      } else if (p.pago) {
        botoesContexto = `<span style="color: var(--accent); font-weight: bold; font-size: 0.85rem; margin-left: 5px;"><i class='bx bx-check-double' style="font-size:1.2rem; vertical-align: middle;"></i> REGULARIZADA</span>`;
      }

      const todosBotoes = `<div style="display:flex; gap: 6px; align-items:center; justify-content: flex-end;">${btnAcoesBase} ${botoesContexto}</div>`;

      return `
    <tr>
      <td data-label="SÓCIO:">${nomeCurto}</td>
      <td data-label="DATA:">${dataF}</td>
      <td data-label="HORA:">${p.hora_aula.substring(0, 5)}</td>
      <td data-label="VALOR:"><strong style="color: var(--accent);">${valorExibido}</strong></td>
      <td data-label="ESTADO:"><span class="badge ${badgeClass}">${p.estado.toUpperCase()}</span></td>
      <td data-label="PAGO:"><span class="badge ${badgePagoClass}">${p.pago ? "SIM" : "NÃO"}</span></td>
      <td data-label="AÇÕES:">${todosBotoes}</td>
    </tr>`;
    })
    .join("");
}

export function initAulasEvents() {
  const tabela = document.getElementById("tabelaAulasParticulares");
  const filtroAtletaAula = document.getElementById("filtroAtletaAula");
  const limparAulaPesquisa = document.getElementById("limparAulaPesquisa");

  // =========================================================
  // 🥊 PESQUISA (DEBOUNCE)
  // =========================================================
  if (filtroAtletaAula) {
    const renderizaFiltroAula = debounce((termo) => {
      const filtrados = (state.aulasParticulares || []).filter((a) =>
        (a.socios?.nome || "").toLowerCase().includes(termo),
      );
      renderizarTabelaAulas(filtrados);
    }, 300);

    filtroAtletaAula.addEventListener("input", (e) => {
      const termo = e.target.value.toLowerCase();
      if (limparAulaPesquisa)
        limparAulaPesquisa.style.display = termo.length > 0 ? "block" : "none";
      renderizaFiltroAula(termo);
    });

    limparAulaPesquisa?.addEventListener("click", () => {
      filtroAtletaAula.value = "";
      limparAulaPesquisa.style.display = "none";
      renderizarTabelaAulas(state.aulasParticulares);
    });
  }

  // =========================================================
  // 🥊 CLIQUES NA TABELA (DELEGAÇÃO DE EVENTOS UNIFICADA)
  // =========================================================
  const modalEditarAula = document.getElementById("modalEditarAula");
  const formEditarAula = document.getElementById("formEditarAula");
  const modalDeleteAula = document.getElementById("modalConfirmDeleteAula");
  let aulaIdParaEliminar = null;

  tabela?.addEventListener("click", async (e) => {
    const btnAceitar = e.target.closest(".btn-aceitar-aula");
    const btnRecusar = e.target.closest(".btn-recusar-aula");
    const btnCobrar = e.target.closest(".btn-faturar-aula-direto");
    const btnEditar = e.target.closest(".btn-edit-aula");
    const btnApagar = e.target.closest(".btn-delete-aula");

    // 1. APROVAR
    if (btnAceitar) {
      document.getElementById("hiddenAulaId").value = btnAceitar.dataset.id;
      document.getElementById("hiddenSocioIdAula").value =
        btnAceitar.dataset.socio;
      document.getElementById("hiddenDataAula").value =
        btnAceitar.dataset.datadb;
      document.getElementById("modalAprovarAula").classList.remove("hidden");
    }

    // 2. RECUSAR
    if (btnRecusar) {
      const aulaId = btnRecusar.dataset.id;
      const socioId = btnRecusar.dataset.socio;
      const dataAula = btnRecusar.dataset.data;

      if (
        confirm(`Tens a certeza que queres RECUSAR a aula do dia ${dataAula}?`)
      ) {
        try {
          await supabase
            .from("aulas_particulares")
            .update({ estado: "Recusada" })
            .eq("id", aulaId);
          await supabase.from("notificacoes").insert([
            {
              socio_id: socioId,
              titulo: "Aula Recusada ❌",
              mensagem: `O Mestre não tem disponibilidade para dia ${dataAula}.`,
              lida: false,
            },
          ]);
          mostrarAviso("Recusada", "Aula recusada.", "sucesso");
          await carregarAulasParticulares();
          await atualizarBadgeAulasPendentes();
        } catch (err) {
          mostrarAviso("Erro", err.message, "erro");
        }
      }
    }

    // 3. COBRAR
    if (btnCobrar) {
      document.getElementById("faturarAulaNome").value = btnCobrar.dataset.nome;
      document.getElementById("faturarAulaData").value = btnCobrar.dataset.data;
      document.getElementById("faturarAulaValor").value =
        btnCobrar.dataset.valor + "€";
      document.getElementById("faturarAulaId").value = btnCobrar.dataset.id;
      document.getElementById("faturarAulaSocioId").value =
        btnCobrar.dataset.socio;
      document.getElementById("faturarAulaDataDb").value =
        btnCobrar.dataset.datadb;
      document.getElementById("modalFaturarAula").classList.remove("hidden");
    }

    // 4. EDITAR AULA
    if (btnEditar) {
      const aulaId = btnEditar.dataset.id;
      const aula = state.aulasParticulares.find((a) => a.id == aulaId);
      if (aula) {
        document.getElementById("editAulaId").value = aula.id;
        document.getElementById("editAulaData").value = aula.data_aula;
        document.getElementById("editAulaHora").value = aula.hora_aula;
        document.getElementById("editAulaValor").value = aula.valor || "";
        document.getElementById("editAulaEstado").value = aula.estado;
        document.getElementById("editAulaPago").value = aula.pago
          ? "true"
          : "false";
        modalEditarAula?.classList.remove("hidden");
      }
    }

    // 5. APAGAR AULA
    if (btnApagar) {
      aulaIdParaEliminar = btnApagar.dataset.id;
      modalDeleteAula?.classList.remove("hidden");
    }
  });

  // =========================================================
  // 🥊 LÓGICA DO FORMULÁRIO DE EDIÇÃO
  // =========================================================
  document
    .getElementById("btnFecharModalEditarAula")
    ?.addEventListener("click", () => {
      modalEditarAula?.classList.add("hidden");
    });

  formEditarAula?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const aulaId = document.getElementById("editAulaId").value;
    const valorInput = document.getElementById("editAulaValor").value;

    const dados = {
      data_aula: document.getElementById("editAulaData").value,
      hora_aula: document.getElementById("editAulaHora").value,
      valor: valorInput ? parseFloat(valorInput) : null,
      estado: document.getElementById("editAulaEstado").value,
      pago: document.getElementById("editAulaPago").value === "true",
    };

    const btnGuardar = document.getElementById("btnGuardarEdicaoAula");
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.innerHTML =
      "A atualizar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnGuardar.disabled = true;

    try {
      const { error } = await supabase
        .from("aulas_particulares")
        .update(dados)
        .eq("id", aulaId);
      if (error) throw error;

      mostrarAviso(
        "Nocaute",
        "Dados da aula atualizados com sucesso.",
        "sucesso",
      );
      modalEditarAula.classList.add("hidden");
      await carregarAulasParticulares();
      await atualizarBadgeAulasPendentes();
    } catch (err) {
      mostrarAviso("Erro", err.message, "erro");
    } finally {
      btnGuardar.innerHTML = textoOriginal;
      btnGuardar.disabled = false;
    }
  });

  // =========================================================
  // 🥊 LÓGICA DE ELIMINAÇÃO DE AULA
  // =========================================================
  document
    .getElementById("btnCancelarDeleteAula")
    ?.addEventListener("click", () => {
      modalDeleteAula?.classList.add("hidden");
      aulaIdParaEliminar = null;
    });

  document
    .getElementById("btnConfirmarDeleteAula")
    ?.addEventListener("click", async () => {
      if (!aulaIdParaEliminar) return;

      const btnConfirma = document.getElementById("btnConfirmarDeleteAula");
      const textoOriginal = btnConfirma.innerHTML;
      btnConfirma.innerHTML =
        "A apagar... <i class='bx bx-loader-alt bx-spin'></i>";
      btnConfirma.disabled = true;

      try {
        const { error } = await supabase
          .from("aulas_particulares")
          .delete()
          .eq("id", aulaIdParaEliminar);
        if (error) throw error;

        mostrarAviso(
          "Eliminada",
          "O registo da aula foi apagado do sistema.",
          "sucesso",
        );
        modalDeleteAula.classList.add("hidden");
        await carregarAulasParticulares();
        await atualizarBadgeAulasPendentes();
      } catch (err) {
        mostrarAviso("Erro", err.message, "erro");
      } finally {
        btnConfirma.innerHTML = textoOriginal;
        btnConfirma.disabled = false;
        aulaIdParaEliminar = null;
      }
    });
}
// =========================================================================
// 🥊 FIM DA ZONA DE ALTERAÇÕES
// =========================================================================

async function atualizarBadgeAulasPendentes() {
  const badgeId = document.getElementById("badgeAulasPendentes");
  const badgeClass = document.querySelector(".badge-tab-inline");
  try {
    const { count } = await supabase
      .from("aulas_particulares")
      .select("*", { count: "exact", head: true })
      .eq("estado", "Pendente");
    const total = count || 0;
    if (badgeId) {
      badgeId.innerText = total;
      total > 0
        ? badgeId.classList.remove("hidden")
        : badgeId.classList.add("hidden");
    }
    if (badgeClass) {
      badgeClass.innerText = total;
      badgeClass.style.display = total > 0 ? "flex" : "none";
    }
  } catch (err) {
    console.error(err);
  }
}

function configurarPagamentoDiretoAula() {
  const formFaturar = document.getElementById("formFaturarAula");
  const modalFaturar = document.getElementById("modalFaturarAula");
  document
    .getElementById("btnFecharModalFaturarAula")
    ?.addEventListener("click", () => modalFaturar.classList.add("hidden"));

  formFaturar?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const aulaId = document.getElementById("faturarAulaId").value;
    const socioId = document.getElementById("faturarAulaSocioId").value;
    const dataAulaDb = document.getElementById("faturarAulaDataDb").value;
    const mesAnoFormatado = dataAulaDb.substring(0, 7);

    // 🥊 CAPTURA E LIMPA O VALOR EXATO QUE ESTÁ A SER COBRADO
    const valorCampo = document.getElementById("faturarAulaValor").value;
    const valorLimpo = parseFloat(
      valorCampo.replace("€", "").replace(",", ".").trim(),
    );

    const btnConfirmar = formFaturar.querySelector('button[type="submit"]');
    const textoOriginal = btnConfirmar.innerHTML;
    btnConfirmar.innerHTML =
      "A faturar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirmar.disabled = true;

    try {
      // 1. Marca a Aula Particular como paga no painel das Aulas
      const { error: errAula } = await supabase
        .from("aulas_particulares")
        .update({ pago: true })
        .eq("id", aulaId);
      if (errAula) throw errAula;

      // 2. VIGILANTE: Procura se a fatura já existe no controlo de mensalidades!
      const { data: faturaExistente } = await supabase
        .from("mensalidades")
        .select("id")
        .eq("socio_id", socioId)
        .eq("tipo", "Aula Particular")
        .eq("mes_ano", mesAnoFormatado)
        .maybeSingle(); // Pode encontrar uma ou nenhuma

      // 3. A MAGIA: Se a fatura existe, atualiza. Se não existe, CRIA COMO PAGA!
      if (faturaExistente) {
        await supabase
          .from("mensalidades")
          .update({ estado: "Pago", valor: valorLimpo })
          .eq("id", faturaExistente.id);
      } else {
        await supabase.from("mensalidades").insert([
          {
            socio_id: socioId,
            mes_ano: mesAnoFormatado,
            tipo: "Aula Particular",
            estado: "Pago",
            valor: valorLimpo,
          },
        ]);
      }

      const dataLegivel = dataAulaDb.split("-").reverse().join("/");
      const tituloPagamento = "Pagamento Recebido 🏆";
      const msg = `O pagamento referente à aula particular de ${dataLegivel} foi liquidado.`;

      // 4. Notifica o atleta
      await supabase.from("notificacoes").insert([
        {
          socio_id: socioId,
          titulo: tituloPagamento,
          mensagem: msg,
          lida: false,
        },
      ]);
      try {
        await supabase.functions.invoke("notificar-alvo", {
          body: {
            socio_id: parseInt(socioId),
            titulo: tituloPagamento,
            mensagem: msg,
          },
        });
      } catch (e) {}

      mostrarAviso(
        "Nocaute!",
        "Pagamento recebido e fatura lançada com sucesso.",
        "sucesso",
      );
      modalFaturar.classList.add("hidden");

      // 5. Atualiza os dois quadros para mostrar os dados frescos
      await carregarAulasParticulares();
      await carregarMensalidades();
    } catch (erro) {
      mostrarAviso("Erro", erro.message, "erro");
    } finally {
      btnConfirmar.innerHTML = textoOriginal;
      btnConfirmar.disabled = false;
    }
  });
}

function configurarRegistoDespesas() {
  const btnAbrirModal = document.getElementById("btnRegistarDespesaGlobal");
  const modalDespesa = document.getElementById("modalDespesa");
  const formDespesa = document.getElementById("formNovaDespesa");

  btnAbrirModal?.addEventListener("click", () => {
    modalDespesa?.classList.remove("hidden");
    document.getElementById("despesaData").value = new Date()
      .toISOString()
      .split("T")[0];
  });

  document
    .getElementById("btnFecharModalDespesa")
    ?.addEventListener("click", () => {
      modalDespesa?.classList.add("hidden");
      formDespesa?.reset();
    });

  formDespesa?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const descricao = document.getElementById("despesaDescricao").value.trim();
    const categoria = document.getElementById("despesaCategoria").value;
    const dataDespesa = document.getElementById("despesaData").value;
    const valor = parseFloat(
      document.getElementById("despesaValor").value.replace(",", "."),
    );

    if (isNaN(valor) || valor <= 0) {
      mostrarAviso("Erro", "Valor inválido.", "erro");
      return;
    }

    const btnGuardar = document.getElementById("btnGuardarDespesa");
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.innerHTML =
      "A Registar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnGuardar.disabled = true;

    try {
      const treinadorLogado =
        state.treinadorAtual ||
        localStorage.getItem("bogas_treinador_nome") ||
        "Desconhecido";
      await supabase.from("despesas").insert([
        {
          descricao,
          categoria,
          data: dataDespesa,
          valor,
          treinador: treinadorLogado,
        },
      ]);

      mostrarAviso(
        "Despesa Registada",
        `Despesa de ${valor.toFixed(2)}€ guardada.`,
        "sucesso",
      );
      modalDespesa.classList.add("hidden");
      formDespesa.reset();
    } catch (err) {
      mostrarAviso("Erro", err.message, "erro");
    } finally {
      btnGuardar.innerHTML = textoOriginal;
      btnGuardar.disabled = false;
    }
  });
}
