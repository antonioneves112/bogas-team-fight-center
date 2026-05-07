/* JS/main.js - O CÉREBRO DA APLICAÇÃO (Versão Blindada) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto } from "./helpers.js";
import { inicializarTabs, inicializarFechoModais } from "./ui.js";
import { executarLogout } from "./auth.js"; // 🥊 IMPORT: Autenticação Centralizada
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
import { extrairPreco } from "./helpers.js";

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

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// A ponte AutoTable (Para gerar os PDFs)
if (window.jspdf && window.jspdf.jsPDF && !window.jsPDF) {
  window.jsPDF = window.jspdf.jsPDF;
}

document.addEventListener("DOMContentLoaded", async () => {
  atualizarBadgeAulasPendentes();

  // 🥊 LÓGICA DE SESSÃO PERMANENTE
  const isTreinadorLogado = localStorage.getItem("bogas_treinador_ativo");

  if (!isTreinadorLogado) {
    window.location.replace("login.html");
    return;
  }

  state.treinadorAtual =
    localStorage.getItem("bogas_treinador_nome") || "Bogas";

  inicializarTabs();
  inicializarFechoModais();
  initSociosEvents();
  initMensalidadesEvents();
  initAulasEvents();

  // =======================================================================
  // 🥊 BOTÃO VERMELHO DO PAINEL (ABRIR INATIVOS)
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

      if (state.inativosAtuais) {
        renderizarTabelaInativos(state.inativosAtuais);
      }
    });
  }

  // 🥊 CONTROLO DO MODAL DE BROADCAST (AVISOS)
  const modalBroadcast = document.getElementById("modalBroadcast");

  document
    .getElementById("btnAbrirModalBroadcast")
    ?.addEventListener("click", () => {
      modalBroadcast?.classList.remove("hidden");
    });

  document
    .getElementById("btnFecharModalBroadcast")
    ?.addEventListener("click", () => {
      modalBroadcast?.classList.add("hidden");
    });

  // -------------------------------------------------------------
  // CONTROLO DE MÊS E ARRANQUE DE DADOS
  // -------------------------------------------------------------
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

  carregarGuerreiros();
  carregarMensalidades();
  carregarAulasParticulares();

  // -------------------------------------------------------------
  // 🥊 MOTOR DE TRANSMISSÃO GLOBAL (METRALHADORA PUSH)
  // -------------------------------------------------------------
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
        console.error("Erro na Metralhadora:", erro);
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

  // -------------------------------------------------------------
  // FILTROS E PESQUISAS (ATIVOS E INATIVOS)
  // -------------------------------------------------------------
  const filtroNome = document.getElementById("filtroNomeSocio");
  const btnLimparSocio = document.getElementById("limparSocio");

  if (filtroNome) {
    filtroNome.addEventListener("input", () => {
      const termo = filtroNome.value.toLowerCase();
      if (btnLimparSocio)
        btnLimparSocio.style.display = termo.length > 0 ? "block" : "none";
      const filtrados = state.guerreirosAtuais.filter((s) =>
        s.nome.toLowerCase().includes(termo),
      );
      renderizarTabelaSocios(filtrados);
    });

    if (btnLimparSocio) {
      btnLimparSocio.addEventListener("click", () => {
        filtroNome.value = "";
        btnLimparSocio.style.display = "none";
        renderizarTabelaSocios(state.guerreirosAtuais);
        filtroNome.focus();
      });
    }

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
    filtroInativo.addEventListener("input", () => {
      const termo = filtroInativo.value.toLowerCase();
      if (btnLimparInativo)
        btnLimparInativo.style.display = termo.length > 0 ? "block" : "none";
      const filtrados = (state.inativosAtuais || []).filter((s) =>
        s.nome.toLowerCase().includes(termo),
      );
      renderizarTabelaInativos(filtrados);
    });

    if (btnLimparInativo) {
      btnLimparInativo.addEventListener("click", () => {
        filtroInativo.value = "";
        btnLimparInativo.style.display = "none";
        renderizarTabelaInativos(state.inativosAtuais);
        filtroInativo.focus();
      });
    }

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
    filtroNomeMensalidade.addEventListener("input", () => {
      const termo = filtroNomeMensalidade.value.toLowerCase();
      if (btnLimparMensalidade)
        btnLimparMensalidade.style.display =
          termo.length > 0 ? "block" : "none";
      const filtrados = state.mensalidadesAtuais.filter((m) =>
        (m.socios?.nome || "").toLowerCase().includes(termo),
      );
      renderizarTabelaMensalidades(filtrados);
    });

    if (btnLimparMensalidade) {
      btnLimparMensalidade.addEventListener("click", () => {
        filtroNomeMensalidade.value = "";
        btnLimparMensalidade.style.display = "none";
        renderizarTabelaMensalidades(state.mensalidadesAtuais);
        filtroNomeMensalidade.focus();
      });
    }

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

  // -------------------------------------------------------------
  // ATALHOS DE ESTATÍSTICAS
  // -------------------------------------------------------------
  const cardPendentes = document.getElementById("cardPendentes");
  if (cardPendentes) {
    cardPendentes.addEventListener("click", () => {
      document.querySelector('.tab-btn[data-target="view-socios"]')?.click();
      const pendentes = state.guerreirosAtuais.filter((s) => {
        const isInativo = s.estado === "Inativo";
        const estaPago = !isInativo && state.idsPagosGlobal.includes(s.id);
        return !isInativo && !estaPago;
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

  // -------------------------------------------------------------
  // EXPORTAÇÃO DE PDFS
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // LOGOUT DO TREINADOR
  // -------------------------------------------------------------
  const btnLogout = document.getElementById("btnLogout");
  const modalConfirmLogout = document.getElementById("modalConfirmLogout");

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      modalConfirmLogout?.classList.remove("hidden");
    });
  }

  document
    .getElementById("btnCancelarLogout")
    ?.addEventListener("click", () => {
      modalConfirmLogout?.classList.add("hidden");
    });

  document
    .getElementById("btnConfirmarLogout")
    ?.addEventListener("click", async (e) => {
      const btnConfirma = e.currentTarget;
      btnConfirma.innerHTML =
        "A sair... <i class='bx bx-loader-alt bx-spin'></i>";
      btnConfirma.disabled = true;

      // 🥊 CORREÇÃO: Utilização da função global de logout
      await executarLogout();
    });
});

// =========================================================================
// 🥊 GESTÃO DE APROVAÇÃO E FATURAÇÃO DE AULAS PARTICULARES
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

    // 🥊 BLINDAGEM DO PREÇO: Limpa o '€' e guarda só o número antes de inserir
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
      // 1. Atualizar o estado da aula para "Aceite"
      const { error: erroAula } = await supabase
        .from("aulas_particulares")
        .update({ estado: "Aceite", valor: valorLimpo })
        .eq("id", aulaId);

      if (erroAula) throw erroAula;

      // 2. Inserir fatura (mensalidade) pendente COM O MÊS CERTO e VALOR LIMPO
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

      // 3. Notificar aluno
      const dataLegivel = dataAulaDb.split("-").reverse().join("/");
      const tituloNotif = "Aula Aprovada ✅";
      const mensagemNotif = `O Mestre aprovou a tua aula particular do dia ${dataLegivel}. Foi adicionado um pagamento pendente de ${valorLimpo}€ ao teu portal.`;
      const { error: erroNotif } = await supabase.from("notificacoes").insert([
        {
          socio_id: socioId,
          titulo: tituloNotif,
          mensagem: mensagemNotif,
          lida: false,
        },
      ]);

      if (erroNotif) throw erroNotif;
      // ==========================================================
      // 🥊 O TIRO DO SNIPER (Acordar o telemóvel do Atleta)
      // ==========================================================
      try {
        // Chamamos uma função específica (ex: 'notificar-alvo') e passamos o ID do sócio
        await supabase.functions.invoke("notificar-alvo", {
          body: {
            socio_id: parseInt(dados.socio_id), // 🥊 O GOLPE VITAL: Força a Número!
            titulo: tituloNotif,
            mensagem: mensagemNotif,
          },
        });
      } catch (erroPush) {
        // Se o push falhar (ex: telemóvel sem net), não bloqueamos o resto do código
        console.warn(
          "Aviso: O Push Nativo falhou, mas a notificação na App foi guardada.",
          erroPush,
        );
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
      console.error("Erro na aprovação:", erro);
      mostrarAviso("Erro", "O golpe falhou: " + erro.message, "erro");
    } finally {
      btnConfirmar.innerHTML = textoOriginal;
      btnConfirmar.disabled = false;
    }
  });
}

configurarAprovacaoAula();

// =========================================================================
// 🥊 GESTÃO DA LISTA DE AULAS PARTICULARES E PESQUISA
// =========================================================================

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

    const pedidosComNomes = pedidos.map((pedido) => {
      const socioEncontrado = listaSocios.find((s) => s.id === pedido.socio_id);
      return {
        ...pedido,
        socios: {
          nome: socioEncontrado ? socioEncontrado.nome : "Atleta Desconhecido",
        },
      };
    });

    state.aulasParticulares = pedidosComNomes;
    renderizarTabelaAulas(state.aulasParticulares);
  } catch (err) {
    console.error("Erro no carregamento das aulas:", err);
    tabela.innerHTML =
      '<tr><td colspan="7" style="color: #ff4d4d; text-align: center;">Erro ao carregar pedidos.</td></tr>';
  }
}

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

      // Lógica Base do Estado
      const badgeClass =
        p.estado === "Aceite"
          ? "badge-ativo"
          : p.estado === "Recusada"
            ? "badge-inativo"
            : "badge-pendente";

      const textoEstado = p.estado.toUpperCase();

      const textoPago = p.pago ? "SIM" : "NÃO";
      const badgePagoClass = p.pago ? "badge-ativo" : "badge-inativo";

      let botoes = "-";
      if (p.estado === "Pendente") {
        botoes = `
          <button class="btn-acao btn-edit btn-aceitar-aula" data-id="${p.id}" data-socio="${p.socio_id}" data-datadb="${p.data_aula}"><i class='bx bx-check'></i></button>
          <button class="btn-acao btn-delete btn-recusar-aula" data-id="${p.id}" data-socio="${p.socio_id}" data-data="${dataF}"><i class='bx bx-x'></i></button>
        `;
      } else if (p.estado === "Aceite" && !p.pago) {
        botoes = `
          <button class="btn-tatico btn-small btn-faturar-aula-direto" 
            data-id="${p.id}" 
            data-socio="${p.socio_id}" 
            data-nome="${p.socios.nome}" 
            data-valor="${p.valor}" 
            data-data="${dataF}"
            data-datadb="${p.data_aula}">
            <i class='bx bx-euro'></i> FATURAR
          </button>
        `;
      } else if (p.pago) {
        botoes = `<span style="color: var(--accent); font-weight: bold; font-size: 0.85rem;"><i class='bx bx-check-double' style="font-size:1.2rem; vertical-align: middle;"></i> REGULARIZADA</span>`;
      }

      return `
      <tr>
        <td data-label="SÓCIO:">${p.socios.nome.toUpperCase()}</td>
        <td data-label="DATA:">${dataF}</td>
        <td data-label="HORA:">${p.hora_aula.substring(0, 5)}</td>
        <td data-label="VALOR:"><strong style="color: var(--accent);">${valorExibido}</strong></td>
        <td data-label="ESTADO:"><span class="badge ${badgeClass}">${textoEstado}</span></td>
        <td data-label="PAGO:"><span class="badge ${badgePagoClass}">${textoPago}</span></td>
        <td data-label="AÇÕES:">${botoes}</td>
      </tr>
    `;
    })
    .join("");
}

// =========================================================================
// 🥊 INICIALIZAR EVENTOS DA TABELA DE AULAS
// =========================================================================
export function initAulasEvents() {
  const tabela = document.getElementById("tabelaAulasParticulares");
  const filtroAtletaAula = document.getElementById("filtroAtletaAula");
  const limparAulaPesquisa = document.getElementById("limparAulaPesquisa");

  // Pesquisa
  if (filtroAtletaAula) {
    filtroAtletaAula.addEventListener("input", () => {
      const termo = filtroAtletaAula.value.toLowerCase();
      if (limparAulaPesquisa)
        limparAulaPesquisa.style.display = termo.length > 0 ? "block" : "none";

      const filtrados = (state.aulasParticulares || []).filter((a) =>
        (a.socios?.nome || "").toLowerCase().includes(termo),
      );
      renderizarTabelaAulas(filtrados);
    });

    limparAulaPesquisa?.addEventListener("click", () => {
      filtroAtletaAula.value = "";
      limparAulaPesquisa.style.display = "none";
      renderizarTabelaAulas(state.aulasParticulares);
    });
  }

  if (!tabela) return;

  // Cliques na Tabela
  tabela.addEventListener("click", async (e) => {
    const btnAceitar = e.target.closest(".btn-aceitar-aula");
    const btnRecusar = e.target.closest(".btn-recusar-aula");

    if (btnAceitar) {
      document.getElementById("hiddenAulaId").value = btnAceitar.dataset.id;
      document.getElementById("hiddenSocioIdAula").value =
        btnAceitar.dataset.socio;
      document.getElementById("hiddenDataAula").value =
        btnAceitar.dataset.datadb;
      document.getElementById("modalAprovarAula").classList.remove("hidden");
    }

    if (btnRecusar) {
      const aulaId = btnRecusar.dataset.id;
      const socioId = btnRecusar.dataset.socio;
      const dataAula = btnRecusar.dataset.data;

      if (
        confirm(`Tens a certeza que queres RECUSAR a aula do dia ${dataAula}?`)
      ) {
        try {
          const { error: erroUpdate } = await supabase
            .from("aulas_particulares")
            .update({ estado: "Recusada" })
            .eq("id", aulaId);
          if (erroUpdate) throw erroUpdate;

          await supabase.from("notificacoes").insert([
            {
              socio_id: socioId,
              titulo: "Aula Recusada ❌",
              mensagem: `Infelizmente o Mestre não tem disponibilidade para a aula particular do dia ${dataAula}.`,
              lida: false,
            },
          ]);

          mostrarAviso(
            "Recusada",
            "A aula foi recusada e o atleta notificado.",
            "sucesso",
          );

          await carregarAulasParticulares();
          await atualizarBadgeAulasPendentes();
        } catch (err) {
          mostrarAviso("Erro", err.message, "erro");
        }
      }
    }

    // 🥊 AÇÃO: COBRAR AULA (NOVO MODAL DEDICADO)
    const btnCobrar = e.target.closest(".btn-faturar-aula-direto");
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
  });
}

// 🥊 FUNÇÃO PARA CONTAR AULAS PENDENTES E ATUALIZAR O BADGE
async function atualizarBadgeAulasPendentes() {
  const badgeId = document.getElementById("badgeAulasPendentes");
  const badgeClass = document.querySelector(".badge-tab-inline");

  try {
    const { count, error } = await supabase
      .from("aulas_particulares")
      .select("*", { count: "exact", head: true })
      .eq("estado", "Pendente");

    if (error) throw error;

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
    console.error("Erro ao buscar contagem de aulas pendentes:", err);
  }
}

// =========================================================================
// 🥊 GESTÃO DO NOVO MODAL DE FATURAÇÃO DIRETA DE AULAS
// =========================================================================
// =========================================================================
// 🥊 GESTÃO DO NOVO MODAL DE FATURAÇÃO DIRETA DE AULAS E MENSALIDADES
// =========================================================================
function configurarPagamentoDiretoAula() {
  const formFaturar = document.getElementById("formFaturarAula");
  const modalFaturar = document.getElementById("modalFaturarAula");
  const btnFecharFaturar = document.getElementById("btnFecharModalFaturarAula");

  btnFecharFaturar?.addEventListener("click", () => {
    modalFaturar.classList.add("hidden");
  });

  formFaturar?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const aulaId = document.getElementById("faturarAulaId").value;
    const socioId = document.getElementById("faturarAulaSocioId").value;
    const dataAulaDb = document.getElementById("faturarAulaDataDb").value;

    const mesAnoFormatado = dataAulaDb.substring(0, 7);

    const btnConfirmar = formFaturar.querySelector('button[type="submit"]');
    const textoOriginal = btnConfirmar.innerHTML;
    btnConfirmar.innerHTML =
      "A faturar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirmar.disabled = true;

    try {
      // 1º GOLPE: Marca a Aula Particular como PAGA = TRUE
      const { error: errAula } = await supabase
        .from("aulas_particulares")
        .update({ pago: true })
        .eq("id", aulaId);

      if (errAula) throw errAula;

      // 2º GOLPE: Procura a mensalidade "Pendente" referente a esta aula e passa a "Pago"
      const { error: errFatura } = await supabase
        .from("mensalidades")
        .update({ estado: "Pago" })
        .eq("socio_id", socioId)
        .eq("tipo", "Aula Particular")
        .eq("mes_ano", mesAnoFormatado)
        .eq("estado", "Pendente");

      if (errFatura) throw errFatura;

      // ==========================================================
      // 3º GOLPE: GUARDAR NOTIFICAÇÃO NA BD E DISPARAR O SNIPER
      // ==========================================================
      const dataLegivel = dataAulaDb.split("-").reverse().join("/");
      const tituloPagamento = "Pagamento Recebido 🏆";
      const mensagemPagamento = `Obrigado, guerreiro! O pagamento referente à aula particular do dia ${dataLegivel} foi liquidado e as tuas contas estão regularizadas.`;

      // Guarda no 'sininho' da app do atleta
      const { error: erroNotifPagamento } = await supabase
        .from("notificacoes")
        .insert([
          {
            socio_id: socioId,
            titulo: tituloPagamento,
            mensagem: mensagemPagamento,
            lida: false,
          },
        ]);

      if (erroNotifPagamento)
        console.warn(
          "Erro ao guardar notificação de pagamento:",
          erroNotifPagamento,
        );

      // Dispara para o telemóvel (Se o target estiver ativo)
      try {
        await supabase.functions.invoke("notificar-alvo", {
          body: {
            socio_id: socioId,
            titulo: tituloPagamento,
            mensagem: mensagemPagamento,
          },
        });
      } catch (erroPushPagamento) {
        console.warn("Aviso: O Push de pagamento falhou.", erroPushPagamento);
      }
      // ==========================================================

      mostrarAviso(
        "Nocaute!",
        "Pagamento recebido e contas regularizadas com sucesso.",
        "sucesso",
      );
      modalFaturar.classList.add("hidden");

      // Atualiza ambas as tabelas
      await carregarAulasParticulares();
      await carregarMensalidades();
    } catch (erro) {
      console.error("Erro na faturação:", erro);
      mostrarAviso(
        "Erro",
        "Falha ao registar pagamento: " + erro.message,
        "erro",
      );
    } finally {
      btnConfirmar.innerHTML = textoOriginal;
      btnConfirmar.disabled = false;
    }
  });
}
// Inicializa o Listener
configurarPagamentoDiretoAula();

// =========================================================================
// 🥊 GESTÃO DO NOVO MODAL DE DESPESAS GLOBAIS
// =========================================================================

function configurarRegistoDespesas() {
  const btnAbrirModal = document.getElementById("btnRegistarDespesaGlobal");
  const modalDespesa = document.getElementById("modalDespesa");
  const btnFecharModal = document.getElementById("btnFecharModalDespesa");
  const formDespesa = document.getElementById("formNovaDespesa");

  // 1. Abrir o Modal
  btnAbrirModal?.addEventListener("click", () => {
    modalDespesa?.classList.remove("hidden");

    // Auto-preencher a data de hoje para facilitar a vida ao Mestre
    const hoje = new Date().toISOString().split("T")[0];
    document.getElementById("despesaData").value = hoje;
  });

  // 2. Fechar o Modal
  btnFecharModal?.addEventListener("click", () => {
    modalDespesa?.classList.add("hidden");
    formDespesa?.reset();
  });

  // 3. Submeter o Formulário
  formDespesa?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const descricao = document.getElementById("despesaDescricao").value.trim();
    const categoria = document.getElementById("despesaCategoria").value;
    const dataDespesa = document.getElementById("despesaData").value;
    const valorDigitado = document.getElementById("despesaValor").value;

    // Converte o valor para número e garante precisão decimal
    const valor = parseFloat(valorDigitado.replace(",", "."));

    if (isNaN(valor) || valor <= 0) {
      mostrarAviso(
        "Erro",
        "O valor da despesa deve ser maior que zero.",
        "erro",
      );
      return;
    }

    const btnGuardar = document.getElementById("btnGuardarDespesa");
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.innerHTML =
      "A Registar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnGuardar.disabled = true;

    try {
      // Usa o nome do treinador logado (Bogas) que foi guardado no init
      const treinadorLogado =
        state.treinadorAtual ||
        localStorage.getItem("bogas_treinador_nome") ||
        "Desconhecido";

      const { error } = await supabase.from("despesas").insert([
        {
          descricao: descricao,
          categoria: categoria,
          data: dataDespesa,
          valor: valor,
          treinador: treinadorLogado,
        },
      ]);

      if (error) throw error;

      mostrarAviso(
        "Despesa Registada",
        `Despesa de ${valor.toFixed(2)}€ guardada no sistema.`,
        "sucesso",
      );

      modalDespesa.classList.add("hidden");
      formDespesa.reset();

      // NOTA: Se futuramente quisermos atualizar uma tabela visível de despesas,
      // chamaríamos aqui uma função como carregarDespesas(). Por agora, o foco
      // será mostrar isto no PDF!
    } catch (err) {
      console.error("Erro ao guardar despesa:", err);
      mostrarAviso("Erro", "Falha ao registar despesa: " + err.message, "erro");
    } finally {
      btnGuardar.innerHTML = textoOriginal;
      btnGuardar.disabled = false;
    }
  });
}

// Inicializa a escuta de eventos do modal de despesas
configurarRegistoDespesas();
