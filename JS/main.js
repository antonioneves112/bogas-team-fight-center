/* JS/main.js - O CÉREBRO DA APLICAÇÃO (Versão Blindada 2.1 - c/ Validação por Clique) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto, extrairPreco, debounce } from "./helpers.js";
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

  // 🥊 BLINDAGEM ANTI-SPAM: Impede que o ecrã acumule demasiados alertas.
  while (container.children.length >= 2) {
    container.removeChild(container.firstChild);
  }

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
      tituloMensalidade.innerText = `Mensalidades ${mesesPT[parseInt(mesNum) - 1]}`;
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

  // CARREGAMENTO INICIAL (Apenas uma vez!)
  carregarGuerreiros();
  carregarMensalidades();
  carregarAulasParticulares();

  // =======================================================================
  // 🥊 1. RADAR EM TEMPO REAL (POP-UP DA APLICAÇÃO)
  // =======================================================================
  supabase
    .channel("radar-admin")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "aulas_particulares" },
      (payload) => {
        if (payload.new.estado === "Pendente") {
          mostrarAviso(
            "Nova Marcação! 🥊",
            "Um atleta acabou de pedir uma aula particular. Verifica a tua agenda!",
            "sucesso",
          );
          carregarAulasParticulares();
        }
      },
    )
    .subscribe();

  const btnAlertasAdmin = document.getElementById("btnAtivarAlertasAdmin");
  if (btnAlertasAdmin) {
    btnAlertasAdmin.addEventListener("click", async () => {
      const PUBLIC_VAPID_KEY =
        "BDlSFCtWMO00daEMrL5sLutOo9iw7KfQ_KlxFvL24zhmvPcA2Cn-M8qez3pJgQQzgzeCi8Pwho7s8Ii1-_cDvXo";
      const btnIcon = btnAlertasAdmin.innerHTML;
      btnAlertasAdmin.innerHTML =
        "<i class='bx bx-loader-alt bx-spin'></i> <span>Aguarde...</span>";
      btnAlertasAdmin.disabled = true;

      try {
        // 1. Verificar se o browser suporta notificações
        if (!("Notification" in window)) {
          throw new Error("Este browser não suporta notificações.");
        }

        // 2. Verificar se o Service Worker está pronto
        if (!("serviceWorker" in navigator)) {
          throw new Error("Service Worker não suportado neste dispositivo.");
        }

        const permissao = await Notification.requestPermission();
        if (permissao === "granted") {
          const registo = await navigator.serviceWorker.ready;
          const sub = await registo.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY),
          });

          const {
            data: { session },
          } = await supabase.auth.getSession();
          const emailTreinador = session
            ? session.user.email
            : "admin@bogasteam.com";

          await supabase.from("admin_push_subscriptions").insert([
            {
              treinador_email: emailTreinador,
              subscricao: JSON.stringify(sub),
            },
          ]);

          mostrarAviso(
            "Radar Ativo",
            "Dispositivo sincronizado com sucesso!",
            "sucesso",
          );
        } else {
          mostrarAviso(
            "Bloqueado",
            "Permissão de notificações negada pelo sistema.",
            "erro",
          );
        }
      } catch (e) {
        console.error("Erro detalhado no telemóvel:", e);
        // Mostra o erro real no ecrã para sabermos o que se passa
        mostrarAviso(
          "Erro Técnico",
          e.message || "Falha desconhecida no telemóvel.",
          "erro",
        );
      } finally {
        btnAlertasAdmin.innerHTML = btnIcon;
        btnAlertasAdmin.disabled = false;
      }
    });
  }

  // =======================================================================
  // ATALHOS DE CARDS (DASHBOARD)
  // =======================================================================
  const cardPendentes = document.getElementById("cardPendentes");
  if (cardPendentes) {
    cardPendentes.addEventListener("click", () => {
      document.querySelector('.tab-btn[data-target="view-socios"]')?.click();

      const faturasMes = state.mensalidadesAtuais || [];
      const idsComDivida = faturasMes
        .filter((m) => m.estado === "Pendente")
        .map((m) => m.socio_id);
      const idsFaturados = faturasMes.map((m) => m.socio_id);

      const pendentes = state.guerreirosAtuais.filter((s) => {
        if (s.estado === "Inativo") return false;
        const temFaturaPendente = idsComDivida.includes(s.id);
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
  // PESQUISAS DINÂMICAS NAS TABELAS (c/ DEBOUNCE Otimizado)
  // =======================================================================
  const filtroNome = document.getElementById("filtroNomeSocio");
  const btnLimparSocio = document.getElementById("limparSocio");

  if (filtroNome) {
    const renderizaFiltroSocio = debounce((termo) => {
      const filtrados = state.guerreirosAtuais.filter((s) =>
        s.nome.toLowerCase().includes(termo),
      );
      renderizarTabelaSocios(filtrados);
    }, 300);

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

  document
    .getElementById("btnExportarPDF")
    ?.addEventListener("click", async () => {
      await exportarMensalidadesPDF(
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

    const dia_aula = dataAulaDb.split("-").reverse().join("/");
    const hora_aula = window.aulaSelecionadaHora || "";

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
          dia_aula: dia_aula,
          hora_aula: hora_aula,
          tipo: "Aula Particular",
          estado: "Pendente",
          valor: valorLimpo,
        },
      ]);
      if (erroFatura) throw erroFatura;

      const tituloNotif = "Aula Aprovada ✅";
      const mensagemNotif = `O Mestre aprovou a tua aula particular do dia ${dia_aula}. Foi adicionado um pagamento pendente de ${valorLimpo}€ ao teu portal.`;

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
  const filtroMes = document.getElementById("filtroMesMensalidade");

  if (!tabela) return;
  tabela.innerHTML =
    '<tr><td colspan="7">A procurar pedidos... <i class="bx bx-loader-alt bx-spin"></i></td></tr>';

  try {
    const mesReferencia =
      filtroMes?.value || new Date().toISOString().substring(0, 7);
    const [ano, mesNum] = mesReferencia.split("-");
    const ultimoDia = new Date(parseInt(ano), parseInt(mesNum), 0).getDate();

    const dataInicio = `${mesReferencia}-01`;
    const dataFim = `${mesReferencia}-${ultimoDia}`;

    const { data: pedidos, error } = await supabase
      .from("aulas_particulares")
      .select(`id, data_aula, hora_aula, socio_id, estado, valor, pago`)
      .gte("data_aula", dataInicio)
      .lte("data_aula", dataFim)
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
    atualizarBadgeAulasPendentes();
  } catch (err) {
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
      const badgeClass =
        p.estado === "Aceite"
          ? "badge-ativo"
          : p.estado === "Recusada"
            ? "badge-inativo"
            : "badge-pendente";
      const badgePagoClass = p.pago ? "badge-ativo" : "badge-inativo";
      const nomeCurto = formatarNomeCurto(p.socios.nome).toUpperCase();

      const btnAcoesBase = `
        <button class="btn-acao btn-edit btn-edit-aula" data-id="${p.id}" title="Editar Pedido"><i class='bx bx-edit'></i></button>
        <button class="btn-acao btn-delete btn-delete-aula" data-id="${p.id}" title="Eliminar Aula"><i class='bx bx-trash'></i></button>
      `;

      let botoesContexto = "";
      if (p.estado === "Pendente") {
        botoesContexto = `
          <button class="btn-acao btn-edit btn-aceitar-aula" data-id="${p.id}" data-socio="${p.socio_id}" data-datadb="${p.data_aula}" data-hora="${p.hora_aula}" title="Aprovar Aula"><i class='bx bx-check'></i></button>
          <button class="btn-acao btn-delete btn-recusar-aula" data-id="${p.id}" data-socio="${p.socio_id}" data-data="${dataF}" title="Recusar Aula"><i class='bx bx-x'></i></button>
        `;
      } else if (p.estado === "Aceite" && !p.pago) {
        botoesContexto = `<button class="btn-tatico btn-small btn-faturar-aula-direto" data-id="${p.id}" data-socio="${p.socio_id}" data-nome="${p.socios.nome}" data-valor="${p.valor}" data-data="${dataF}" data-datadb="${p.data_aula}" data-hora="${p.hora_aula}"><i class='bx bx-euro'></i> FATURAR</button>`;
      } else if (p.pago) {
        botoesContexto = `<span style="color: var(--accent); font-weight: bold; font-size: 0.85rem; margin-left: 5px;"><i class='bx bx-check-double' style="font-size:1.2rem; vertical-align: middle;"></i> REGULARIZADA</span>`;
      }

      return `
    <tr>
      <td data-label="SÓCIO:">${nomeCurto}</td>
      <td data-label="DATA:">${dataF}</td>
      <td data-label="HORA:">${p.hora_aula.substring(0, 5)}</td>
      <td data-label="VALOR:"><strong style="color: var(--accent);">${valorExibido}</strong></td>
      <td data-label="ESTADO:"><span class="badge ${badgeClass}">${p.estado.toUpperCase()}</span></td>
      <td data-label="PAGO:"><span class="badge ${badgePagoClass}">${p.pago ? "SIM" : "NÃO"}</span></td>
      <td data-label="AÇÕES:"><div style="display:flex; gap: 6px; align-items:center; justify-content: flex-end;">${btnAcoesBase} ${botoesContexto}</div></td>
    </tr>`;
    })
    .join("");
}

export function initAulasEvents() {
  const tabela = document.getElementById("tabelaAulasParticulares");
  const filtroAtletaAula = document.getElementById("filtroAtletaAula");
  const limparAulaPesquisa = document.getElementById("limparAulaPesquisa");

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

  const modalEditarAula = document.getElementById("modalEditarAula");
  const formEditarAula = document.getElementById("formEditarAula");
  const modalDeleteAula = document.getElementById("modalConfirmDeleteAula");

  let aulaIdParaEliminar = null;
  let aulaParaRecusar = null;

  tabela?.addEventListener("click", async (e) => {
    const btnAceitar = e.target.closest(".btn-aceitar-aula");
    const btnRecusar = e.target.closest(".btn-recusar-aula");
    const btnCobrar = e.target.closest(".btn-faturar-aula-direto");
    const btnEditar = e.target.closest(".btn-edit-aula");
    const btnApagar = e.target.closest(".btn-delete-aula");

    if (btnAceitar) {
      document.getElementById("hiddenAulaId").value = btnAceitar.dataset.id;
      document.getElementById("hiddenSocioIdAula").value =
        btnAceitar.dataset.socio;
      document.getElementById("hiddenDataAula").value =
        btnAceitar.dataset.datadb;
      window.aulaSelecionadaHora = btnAceitar.dataset.hora;
      document.getElementById("modalAprovarAula").classList.remove("hidden");
    }

    if (btnRecusar) {
      aulaParaRecusar = {
        id: btnRecusar.dataset.id,
        socio: btnRecusar.dataset.socio,
        data: btnRecusar.dataset.data,
      };
      const dataSpan = document.getElementById("spanDataRecusarAula");
      if (dataSpan) dataSpan.innerText = aulaParaRecusar.data;
      document
        .getElementById("modalConfirmRecusarAula")
        ?.classList.remove("hidden");
    }

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
      window.aulaSelecionadaHora = btnCobrar.dataset.hora;
      document.getElementById("modalFaturarAula").classList.remove("hidden");
    }

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

    if (btnApagar) {
      aulaIdParaEliminar = btnApagar.dataset.id;
      modalDeleteAula?.classList.remove("hidden");
    }
  });

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

  document
    .getElementById("btnCancelarRecusarAula")
    ?.addEventListener("click", () => {
      document
        .getElementById("modalConfirmRecusarAula")
        ?.classList.add("hidden");
      aulaParaRecusar = null;
    });

  document
    .getElementById("btnConfirmarRecusarAula")
    ?.addEventListener("click", async () => {
      if (!aulaParaRecusar) return;

      const btnConfirma = document.getElementById("btnConfirmarRecusarAula");
      const textoOriginal = btnConfirma.innerHTML;
      btnConfirma.innerHTML =
        "A recusar... <i class='bx bx-loader-alt bx-spin'></i>";
      btnConfirma.disabled = true;

      try {
        await supabase
          .from("aulas_particulares")
          .update({ estado: "Recusada" })
          .eq("id", aulaParaRecusar.id);
        await supabase.from("notificacoes").insert([
          {
            socio_id: aulaParaRecusar.socio,
            titulo: "Aula Recusada ❌",
            mensagem: `O Mestre não tem disponibilidade para dia ${aulaParaRecusar.data}.`,
            lida: false,
          },
        ]);

        mostrarAviso("Recusada", "Aula recusada.", "sucesso");
        document
          .getElementById("modalConfirmRecusarAula")
          ?.classList.add("hidden");

        await carregarAulasParticulares();
        await atualizarBadgeAulasPendentes();
      } catch (err) {
        mostrarAviso("Erro", err.message, "erro");
      } finally {
        btnConfirma.innerHTML = textoOriginal;
        btnConfirma.disabled = false;
        aulaParaRecusar = null;
      }
    });
}

// =========================================================
// 🥊 LÓGICA DE CRIAÇÃO DE NOVA AULA (PELO TREINADOR)
// =========================================================
const btnAddAula = document.getElementById("btnAddAulaAdmin");
const modalNovaAula = document.getElementById("modalNovaAulaAdmin");
const formNovaAula = document.getElementById("formNovaAulaAdmin");
const inputSocioSearchAula = document.getElementById("novaAulaSocioSearch");
const inputSocioIdAula = document.getElementById("novaAulaSocioId");

btnAddAula?.addEventListener("click", () => {
  formNovaAula?.reset();
  if (inputSocioIdAula) inputSocioIdAula.value = "";

  const datalist = document.getElementById("listaSociosAula");
  if (datalist && state.guerreirosAtuais) {
    datalist.innerHTML = "";
    state.guerreirosAtuais.forEach((s) => {
      if (s.estado !== "Inativo") {
        const opt = document.createElement("option");
        opt.value = s.nome;
        opt.setAttribute("data-id", s.id);
        datalist.appendChild(opt);
      }
    });
  }
  modalNovaAula?.classList.remove("hidden");
});

document
  .getElementById("btnFecharModalNovaAula")
  ?.addEventListener("click", () => {
    modalNovaAula?.classList.add("hidden");
  });

inputSocioSearchAula?.addEventListener("input", (e) => {
  const opt = Array.from(
    document.getElementById("listaSociosAula")?.options || [],
  ).find((o) => o.value === e.target.value);
  if (inputSocioIdAula)
    inputSocioIdAula.value = opt ? opt.getAttribute("data-id") : "";
});

formNovaAula?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!inputSocioIdAula.value) {
    mostrarAviso(
      "Atenção",
      "Por favor, seleciona um atleta válido da lista.",
      "erro",
    );
    return;
  }

  const dataAula = document.getElementById("novaAulaData").value;
  const horaAula = document.getElementById("novaAulaHora").value;
  const valorInput = document.getElementById("novaAulaValor").value;
  const estadoAula = document.getElementById("novaAulaEstado").value;

  const btnGuardar = document.getElementById("btnGuardarNovaAula");
  const txtOriginal = btnGuardar.innerHTML;
  btnGuardar.innerHTML =
    "A Registar... <i class='bx bx-loader-alt bx-spin'></i>";
  btnGuardar.disabled = true;

  try {
    const socioId = inputSocioIdAula.value;
    const valorLimpo = valorInput ? parseFloat(valorInput) : null;

    const { error: errAula } = await supabase
      .from("aulas_particulares")
      .insert([
        {
          socio_id: socioId,
          data_aula: dataAula,
          hora_aula: horaAula,
          valor: valorLimpo,
          estado: estadoAula,
          pago: false,
        },
      ]);
    if (errAula) throw errAula;

    if (estadoAula === "Aceite" && valorLimpo !== null) {
      const mesAnoFormatado = dataAula.substring(0, 7);
      const diaF = dataAula.split("-").reverse().join("/");

      await supabase.from("mensalidades").insert([
        {
          socio_id: socioId,
          mes_ano: mesAnoFormatado,
          dia_aula: diaF,
          hora_aula: horaAula,
          tipo: "Aula Particular",
          estado: "Pendente",
          valor: valorLimpo,
        },
      ]);

      const t = "Aula Marcada ✅";
      const m = `O Mestre marcou-te uma aula particular para dia ${diaF} às ${horaAula.substring(0, 5)}. A fatura foi gerada!`;
      await supabase
        .from("notificacoes")
        .insert([{ socio_id: socioId, titulo: t, message: m, lida: false }]);
    }

    mostrarAviso("Nocaute Técnico", "Aula agendada com sucesso!", "sucesso");
    modalNovaAula.classList.add("hidden");
    await carregarAulasParticulares();
    await atualizarBadgeAulasPendentes();
    if (estadoAula === "Aceite") await carregarMensalidades();
  } catch (err) {
    mostrarAviso("Erro", err.message, "erro");
  } finally {
    btnGuardar.innerHTML = txtOriginal;
    btnGuardar.disabled = false;
  }
});

export async function atualizarBadgeAulasPendentes() {
  const badgeId = document.getElementById("badgeAulas");
  const badgeClass = document.querySelector(".badge-tab-inline");

  try {
    const { count } = await supabase
      .from("aulas_particulares")
      .select("*", { count: "exact", head: true })
      .eq("estado", "Pendente");

    const total = count || 0;
    if (badgeId) {
      badgeId.innerText = total;
      badgeId.style.display = total > 0 ? "flex" : "none";
    }
    if (badgeClass) {
      badgeClass.innerText = total;
      badgeClass.style.display = total > 0 ? "flex" : "none";
    }
  } catch (err) {
    console.error("Erro a contar aulas:", err);
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
    const valorCampo = document.getElementById("faturarAulaValor").value;
    const valorLimpo = parseFloat(
      valorCampo.replace("€", "").replace(",", ".").trim(),
    );

    const dia_aula = dataAulaDb.split("-").reverse().join("/");
    const hora_aula = window.aulaSelecionadaHora || "";

    const btnConfirmar = formFaturar.querySelector('button[type="submit"]');
    const textoOriginal = btnConfirmar.innerHTML;
    btnConfirmar.innerHTML =
      "A faturar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirmar.disabled = true;

    try {
      const { error: errAula } = await supabase
        .from("aulas_particulares")
        .update({ pago: true })
        .eq("id", aulaId);
      if (errAula) throw errAula;

      const { data: faturaExistente } = await supabase
        .from("mensalidades")
        .select("id")
        .eq("socio_id", socioId)
        .eq("tipo", "Aula Particular")
        .eq("mes_ano", mesAnoFormatado)
        .maybeSingle();

      if (faturaExistente) {
        await supabase
          .from("mensalidades")
          .update({ estado: "Pago", valor: valorLimpo, dia_aula, hora_aula })
          .eq("id", faturaExistente.id);
      } else {
        await supabase.from("mensalidades").insert([
          {
            socio_id: socioId,
            mes_ano: mesAnoFormatado,
            dia_aula,
            hora_aula,
            tipo: "Aula Particular",
            estado: "Pago",
            valor: valorLimpo,
          },
        ]);
      }

      const tituloPagamento = "Pagamento Recebido 🏆";
      const msg = `O pagamento referente à aula particular de ${dia_aula} foi liquidado.`;

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
  const btnPrincipal = document.getElementById("btnRegistarDespesaGlobal");
  const modalOpcoes = document.getElementById("modalOpcoesDespesa");
  const modalNova = document.getElementById("modalDespesa");
  const modalHistorico = document.getElementById("modalHistoricoDespesas");
  const formNova = document.getElementById("formNovaDespesa");

  btnPrincipal?.addEventListener("click", () =>
    modalOpcoes?.classList.remove("hidden"),
  );
  document
    .getElementById("btnFecharOpcoesDespesa")
    ?.addEventListener("click", () => modalOpcoes?.classList.add("hidden"));

  document
    .getElementById("btnOpcaoNovaDespesa")
    ?.addEventListener("click", () => {
      modalOpcoes?.classList.add("hidden");
      modalNova?.classList.remove("hidden");
      document.getElementById("despesaData").value = new Date()
        .toISOString()
        .split("T")[0];
    });

  document
    .getElementById("btnOpcaoHistoricoDespesa")
    ?.addEventListener("click", async () => {
      modalOpcoes?.classList.add("hidden");
      modalHistorico?.classList.remove("hidden");
      await carregarHistoricoDespesas();
    });

  document
    .getElementById("btnFecharModalDespesa")
    ?.addEventListener("click", () => {
      modalNova?.classList.add("hidden");
      formNova?.reset();
    });

  formNova?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const valor = parseFloat(
      document.getElementById("despesaValor").value.replace(",", "."),
    );
    const btnGuardar = document.getElementById("btnGuardarDespesa");
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.innerHTML =
      "A Registar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnGuardar.disabled = true;

    try {
      await supabase.from("despesas").insert([
        {
          descricao: document.getElementById("despesaDescricao").value.trim(),
          categoria: document.getElementById("despesaCategoria").value,
          data: document.getElementById("despesaData").value,
          valor,
          treinador:
            state.treinadorAtual ||
            localStorage.getItem("bogas_treinador_nome"),
        },
      ]);
      mostrarAviso(
        "Despesa Registada",
        `Saída de ${valor.toFixed(2)}€ guardada.`,
        "sucesso",
      );
      modalNova?.classList.add("hidden");
      formNova.reset();
    } catch (err) {
      mostrarAviso("Erro", err.message, "erro");
    } finally {
      btnGuardar.innerHTML = textoOriginal;
      btnGuardar.disabled = false;
    }
  });
}

async function carregarHistoricoDespesas() {
  const tabela = document.getElementById("tabelaHistoricoDespesas");
  if (!tabela) return;
  tabela.innerHTML =
    '<tr><td colspan="5" class="table-empty-state">A consultar...</td></tr>';

  try {
    const { data: despesas, error } = await supabase
      .from("despesas")
      .select("*")
      .order("data", { ascending: false });
    if (error) throw error;
    state.despesasCache = despesas;

    if (!despesas || despesas.length === 0) {
      tabela.innerHTML =
        '<tr><td colspan="5" class="table-empty-state">Sem despesas registadas.</td></tr>';
      return;
    }

    tabela.innerHTML = despesas
      .map((d) => {
        const dataF = d.data.split("-").reverse().join("/");
        return `
            <tr>
                <td data-label="Data:">${dataF}</td>
                <td data-label="Descrição:">${d.descricao}</td>
                <td data-label="Categoria:">${d.categoria}</td>
                <td data-label="Valor:"><strong>${d.valor.toFixed(2)}€</strong></td>
                <td data-label="Ações:">
                    <div style="display:flex; gap: 6px; align-items:center; justify-content: center;">
                        <button class="btn-acao btn-edit btn-edit-despesa" data-id="${d.id}"><i class='bx bx-edit'></i></button>
                        <button class="btn-acao btn-delete btn-delete-despesa" data-id="${d.id}"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            </tr>`;
      })
      .join("");
    configurarAcoesHistoricoDespesas();
  } catch (err) {
    tabela.innerHTML =
      '<tr><td colspan="5" style="color: #ff4d4d;">Erro ao carregar histórico.</td></tr>';
  }
}

function configurarAcoesHistoricoDespesas() {
  const tabela = document.getElementById("tabelaHistoricoDespesas");
  const modalEditar = document.getElementById("modalEditarDespesa");
  const formEditar = document.getElementById("formEditarDespesa");
  const modalDelete = document.getElementById("modalConfirmDeleteDespesa");
  let idParaEliminar = null;

  tabela?.addEventListener("click", (e) => {
    const btnEdit = e.target.closest(".btn-edit-despesa");
    const btnDel = e.target.closest(".btn-delete-despesa");

    if (btnEdit) {
      const despesa = state.despesasCache.find(
        (d) => d.id == btnEdit.dataset.id,
      );
      if (despesa) {
        document.getElementById("editDespesaId").value = despesa.id;
        document.getElementById("editDespesaDescricao").value =
          despesa.descricao;
        document.getElementById("editDespesaCategoria").value =
          despesa.categoria;
        document.getElementById("editDespesaData").value = despesa.data;
        document.getElementById("editDespesaValor").value = despesa.valor;
        modalEditar?.classList.remove("hidden");
      }
    }
    if (btnDel) {
      idParaEliminar = btnDel.dataset.id;
      modalDelete?.classList.remove("hidden");
    }
  });

  document
    .getElementById("btnFecharModalEditarDespesa")
    ?.addEventListener("click", () => modalEditar?.classList.add("hidden"));
  document
    .getElementById("btnFecharHistoricoDespesas")
    ?.addEventListener("click", () =>
      document
        .getElementById("modalHistoricoDespesas")
        ?.classList.add("hidden"),
    );
  document
    .getElementById("btnCancelarDeleteDespesa")
    ?.addEventListener("click", () => modalDelete?.classList.add("hidden"));

  formEditar?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("editDespesaId").value;
    const dados = {
      descricao: document.getElementById("editDespesaDescricao").value.trim(),
      categoria: document.getElementById("editDespesaCategoria").value,
      data: document.getElementById("editDespesaData").value,
      valor: parseFloat(document.getElementById("editDespesaValor").value),
    };
    try {
      await supabase.from("despesas").update(dados).eq("id", id);
      mostrarAviso("Atualizada", "Dados da despesa corrigidos.", "sucesso");
      modalEditar?.classList.add("hidden");
      await carregarHistoricoDespesas();
    } catch (err) {
      mostrarAviso("Erro", err.message, "erro");
    }
  });

  document
    .getElementById("btnConfirmarDeleteDespesa")
    ?.addEventListener("click", async () => {
      if (!idParaEliminar) return;
      try {
        await supabase.from("despesas").delete().eq("id", idParaEliminar);
        mostrarAviso(
          "Eliminada",
          "Registo removido permanentemente.",
          "sucesso",
        );
        modalDelete?.classList.add("hidden");
        await carregarHistoricoDespesas();
      } catch (err) {
        mostrarAviso("Erro", err.message, "erro");
      }
    });
}

// =========================================================================
// 🥊 ESCUDO DE SEGURANÇA MÁXIMA: ELIMINAÇÃO DE SÓCIOS POR APELIDO/NOME
// =========================================================================
let socioIdParaEliminar = null;
let socioNomeParaApagar = "";

// A: Função exportada para ser chamada no clique do caixote do lixo da tabela (socios.js)
export function abrirModalEliminarSocio(id, nome) {
  socioIdParaEliminar = id;
  socioNomeParaApagar = nome;

  // Injeta o nome do atleta para visualização no modal
  const alvoNome = document.getElementById("deleteSocioNomeAlvo");
  if (alvoNome) alvoNome.textContent = nome;

  // Limpa o campo de escrita tática
  const inputConfirm = document.getElementById("inputDeleteSocioNome");
  if (inputConfirm) inputConfirm.value = "";

  // Destranca o modal tirando o 'hidden'
  document
    .getElementById("modalConfirmDeleteSocio")
    ?.classList.remove("hidden");
}

// B: Escuta o clique no botão de eliminação e avalia o escudo de segurança
document
  .getElementById("btnConfirmarDeleteSocio")
  ?.addEventListener("click", async (e) => {
    const inputNome = document
      .getElementById("inputDeleteSocioNome")
      .value.trim();

    // 🛑 VALIDAÇÃO 1: Campo totalmente esquecido e em branco
    if (inputNome === "") {
      mostrarAviso(
        "Atenção Mestre",
        "Tens de escrever o nome exato do atleta para prosseguir!",
        "erro",
      );
      return;
    }

    // 🛑 VALIDAÇÃO 2: Errou letras maiúsculas, minúsculas ou espaços
    if (inputNome !== socioNomeParaApagar) {
      mostrarAviso(
        "Aviso de Bloqueio",
        "O nome digitado não coincide com o alvo. Verifica maiúsculas!",
        "erro",
      );
      return;
    }

    // Se passou na guarda, executa a eliminação definitiva no banco de dados
    const btnConfirma = e.currentTarget;
    const textoOriginal = btnConfirma.innerHTML;
    btnConfirma.innerHTML =
      "A apagar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirma.disabled = true;

    try {
      if (socioIdParaEliminar) {
        const { error } = await supabase
          .from("socios")
          .delete()
          .eq("id", socioIdParaEliminar);

        if (error) throw error;

        mostrarAviso(
          "Nocaute Completo",
          "Atleta removido do sistema com sucesso.",
          "sucesso",
        );
        document
          .getElementById("modalConfirmDeleteSocio")
          ?.classList.add("hidden");

        // Atualiza os contadores e a listagem no ecrã imediatamente
        carregarGuerreiros();
      }
    } catch (err) {
      mostrarAviso(
        "Falha no Golpe",
        `Não foi possível eliminar: ${err.message}`,
        "erro",
      );
    } finally {
      btnConfirma.innerHTML = textoOriginal;
      btnConfirma.disabled = false;
      socioIdParaEliminar = null;
      socioNomeParaApagar = "";
    }
  });

// C: Fecho seguro do modal ao clicar em Cancelar
document
  .getElementById("btnCancelarDeleteSocio")
  ?.addEventListener("click", () => {
    document.getElementById("modalConfirmDeleteSocio")?.classList.add("hidden");
    socioIdParaEliminar = null;
    socioNomeParaApagar = "";
  });
// =======================================================================
// 🥊 1. VERIFICAÇÃO DO ESTADO DO RADAR (COM BLINDAGEM MÓVEL)
// =======================================================================
async function verificarEstadoRadarAdmin() {
  const btnAlertasAdmin = document.getElementById("btnAtivarAlertasAdmin");
  if (!btnAlertasAdmin) return;

  const icone = btnAlertasAdmin.querySelector("i");
  const texto = btnAlertasAdmin.querySelector("span");

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    const emailTreinador = session.user.email;

    const permissao = Notification.permission;
    let temRegistoValido = false;

    if ("serviceWorker" in navigator && permissao === "granted") {
      const registo = await navigator.serviceWorker.ready;
      const subAtual = await registo.pushManager.getSubscription();

      if (subAtual) {
        const { data } = await supabase
          .from("admin_push_subscriptions")
          .select("id")
          .eq("treinador_email", emailTreinador)
          .maybeSingle();

        if (data) temRegistoValido = true;
      }
    }

    if (temRegistoValido) {
      btnAlertasAdmin.style.borderColor = "var(--accent)";
      btnAlertasAdmin.style.color = "var(--accent)";
      btnAlertasAdmin.style.backgroundColor = "";
      if (texto) texto.innerText = "Radar Ativo";
      if (icone) icone.className = "bx bx-bell";
    } else {
      btnAlertasAdmin.style.borderColor = "#ff4d4d";
      btnAlertasAdmin.style.color = "#ff4d4d";
      if (texto) texto.innerText = "Ativar Alertas";
      if (icone) icone.className = "bx bx-bell-off";
    }
  } catch (err) {
    console.warn("Aviso na verificação do radar:", err);
  }
}

// Executa a verificação inicial do radar assim que o script arranca
verificarEstadoRadarAdmin();

// =======================================================================
// 🥊 2. EVENTO DE CLIQUE DO BOTÃO DE ALERTAS (BLINDADO PARA MOBILE)
// =======================================================================
const btnAlertasAdmin = document.getElementById("btnAtivarAlertasAdmin");

if (btnAlertasAdmin) {
  btnAlertasAdmin.addEventListener("click", async (e) => {
    e.preventDefault();

    const PUBLIC_VAPID_KEY =
      "BDlSFCtWMO00daEMrL5sLutOo9iw7KfQ_KlxFvL24zhmvPcA2Cn-M8qez3pJgQQzgzeCi8Pwho7s8Ii1-_cDvXo";
    const btnIcon = btnAlertasAdmin.innerHTML;
    btnAlertasAdmin.innerHTML =
      "<i class='bx bx-loader-alt bx-spin'></i> <span>Aguarde...</span>";
    btnAlertasAdmin.disabled = true;

    try {
      if (!("Notification" in window)) {
        throw new Error("O teu telemóvel não suporta notificações web.");
      }

      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Worker indisponível neste dispositivo.");
      }

      const permissao = await Notification.requestPermission();

      if (permissao === "granted") {
        const registo = await navigator.serviceWorker.ready;
        const sub = await registo.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY),
        });

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const emailTreinador = session
          ? session.user.email
          : "admin@bogasteam.com";

        await supabase.from("admin_push_subscriptions").insert([
          {
            treinador_email: emailTreinador,
            subscricao: JSON.stringify(sub),
          },
        ]);

        mostrarAviso(
          "Radar Ativo",
          "Dispositivo sincronizado com sucesso!",
          "sucesso",
        );
        verificarEstadoRadarAdmin();
      } else {
        mostrarAviso(
          "Bloqueado",
          "Permissão de notificações recusada pelo sistema.",
          "erro",
        );
      }
    } catch (err) {
      console.error("Erro no clique do telemóvel:", err);
      mostrarAviso(
        "Erro Técnico",
        err.message || "Falha ao ativar o radar.",
        "erro",
      );
    } finally {
      btnAlertasAdmin.innerHTML = btnIcon;
      btnAlertasAdmin.disabled = false;
    }
  });
}

// =========================================================================
// 🥊 FUNÇÃO GLOBAL DE CONVERSÃO VAPID
// =========================================================================
function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// =======================================================================
// 🥊 DISPARADOR AUTOMÁTICO DE RADAR (BLINDAGEM MÓVEL)
// =======================================================================
async function ativarRadarAutomaticamente() {
  const PUBLIC_VAPID_KEY =
    "BDlSFCtWMO00daEMrL5sLutOo9iw7KfQ_KlxFvL24zhmvPcA2Cn-M8qez3pJgQQzgzeCi8Pwho7s8Ii1-_cDvXo";

  try {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    // Se já tiver permissão concedida, garante que está subscrito em segundo plano
    if (Notification.permission === "granted") {
      const registo = await navigator.serviceWorker.ready;
      let sub = await registo.pushManager.getSubscription();

      if (!sub) {
        sub = await registo.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY),
        });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const emailTreinador = session.user.email;

        // Verifica se já existe na base de dados para não duplicar
        const { data: existe } = await supabase
          .from("admin_push_subscriptions")
          .select("id")
          .eq("treinador_email", emailTreinador)
          .maybeSingle();

        if (!existe) {
          await supabase
            .from("admin_push_subscriptions")
            .insert([
              {
                treinador_email: emailTreinador,
                subscricao: JSON.stringify(sub),
              },
            ]);
        }
      }
    }
  } catch (err) {
    console.warn("Aviso no radar automático:", err);
  }
}

// Executa o disparo logo que o motor arranca
ativarRadarAutomaticamente();
