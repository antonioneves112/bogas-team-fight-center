/* JS/portal.js - MOTOR DO PORTAL (VERSÃO FINAL E AFINADA) */
import { supabase } from "./supabase.js";
import { formatarNomeCurto } from "./helpers.js";

// 🥊 VARIÁVEIS DE NÍVEL DE MÓDULO
let atletaLogadoId = null;
let notificacaoParaApagarId = null;
let mensagensAtleta = [];

// =========================================================================
// 🥊 FUNÇÃO GLOBAL (MOVIDA PARA FORA PARA EVITAR ERRO DE "NOT DEFINED")
// =========================================================================
async function buscarProximaAula(atletaId) {
  const elTexto = document.getElementById("atletaProximaAula");
  const elBadge = document.getElementById("statusProximaAula");
  if (!elTexto || !elBadge) return;

  try {
    const { data: aula, error } = await supabase
      .from("aulas_particulares")
      .select("*")
      .eq("socio_id", atletaId)
      .order("data_aula", { ascending: true })
      .gte("data_aula", new Date().toISOString().split("T")[0])
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (aula) {
      const [ano, mes, dia] = aula.data_aula.split("-");
      elTexto.innerHTML = `${dia}/${mes}<br><span class="hora-destaque">${aula.hora_aula.substring(0, 5)}</span>`;
      elBadge.classList.remove("hidden");
      elBadge.innerText = aula.estado;
      elBadge.className =
        aula.estado === "Aceite"
          ? "badge-status status-apto"
          : "badge-status status-nao-apto";
    } else {
      elTexto.innerText = "Nenhuma agendada";
      elBadge.classList.add("hidden");
    }
  } catch (err) {
    console.error("Erro ao carregar aula:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const formLogin = document.getElementById("formLoginAtleta");
  const loginSection = document.getElementById("login-section");
  const portalSection = document.getElementById("portal-section");
  const btnSair = document.getElementById("btnSairPortal");

  // =========================================================================
  // --- MOTOR DE SESSÃO E CARREGAMENTO DO PORTAL ---
  // =========================================================================

  async function iniciarPortalParaAtleta(socio) {
    atletaLogadoId = socio.id;
    localStorage.setItem("bogas_atleta_id", socio.id);

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

    const { data: pagamento } = await supabase
      .from("mensalidades")
      .select("estado")
      .eq("socio_id", socio.id)
      .eq("mes_ano", mesAtual)
      .maybeSingle();

    // Preenchimento de dados do portal
    const elNome = document.getElementById("atletaNome");
    if (elNome) elNome.innerText = formatarNomeCurto(socio.nome || "Guerreiro");

    const elMod = document.getElementById("atletaModalidade");
    if (elMod)
      elMod.innerHTML = `<i class='bx bx-medal'></i> ${socio.modalidade || "Atleta"}`;

    const elFoto = document.getElementById("atletaFoto");
    if (elFoto) {
      elFoto.onerror = function () {
        this.onerror = null;
        this.src = "./img/PRETO.jpg";
      };
      elFoto.src =
        socio.foto_url && socio.foto_url.trim() !== ""
          ? socio.foto_url
          : "./img/PRETO.jpg";
    }

    const elInscricao = document.getElementById("atletaDataInscricao");
    if (elInscricao && socio.data_inscricao) {
      const [ano, mes, dia] = socio.data_inscricao.split("-");
      elInscricao.innerText = `${dia}/${mes}/${ano}`;
    }

    // ========================================================================
    // 🥊 LÓGICA DE GRADUAÇÃO
    // ========================================================================
    const elGrad = document.getElementById("atletaGraduacao");
    const elStatusApto = document.getElementById("statusAptidao");
    const elLabelData = document.getElementById("labelUltimaGrad");

    if (elGrad) {
      const graduacaoAtual = socio.graduacao || socio.graduação || "Branco";
      elGrad.innerText = graduacaoAtual;

      const regras = {
        Branco: 5,
        Amarelo: 6,
        Laranja: 8,
        Verde: 10,
        Azul: 12,
        Vermelho: 18,
        Castanho: 24,
        Negro: 999,
      };

      const mesesNecessarios = regras[graduacaoAtual] || 5;
      const dataReferencia =
        socio.data_ultima_graduacao || socio.data_inscricao;

      if (elLabelData) {
        if (socio.data_ultima_graduacao) {
          const [ano, mes, dia] = socio.data_ultima_graduacao.split("-");
          elLabelData.innerText = `Última: ${dia}/${mes}/${ano}`;
        } else {
          elLabelData.innerText = `Última: N/D`;
        }
      }

      if (elStatusApto && dataReferencia && graduacaoAtual !== "Negro") {
        elStatusApto.classList.remove("hidden");

        const anoRef = dataReferencia.substring(0, 4);
        const mesRef = dataReferencia.substring(5, 7);
        const dataFiltro = `${anoRef}-${mesRef}`;

        const { data: faturasPagas } = await supabase
          .from("mensalidades")
          .select("mes_ano, tipo")
          .eq("socio_id", socio.id)
          .eq("estado", "Pago")
          .gte("mes_ano", dataFiltro);

        const mensalidadesValidas = faturasPagas
          ? faturasPagas.filter((f) => !f.tipo || f.tipo === "Mensalidade")
          : [];

        const mesesContados = mensalidadesValidas.length;

        if (mesesContados >= mesesNecessarios) {
          elStatusApto.innerText = "Apto para Exame";
          elStatusApto.className = "badge-status status-apto";
        } else {
          const emFalta = mesesNecessarios - mesesContados;
          elStatusApto.innerText = `Faltam ${emFalta} Meses`;
          elStatusApto.className = "badge-status status-nao-apto";
        }
      } else if (elStatusApto && graduacaoAtual === "Negro") {
        elStatusApto.classList.remove("hidden");
        elStatusApto.innerText = "Mestre";
        elStatusApto.className = "badge-status status-apto";
      }
    }

    const elFed = document.getElementById("atletaFederacao");
    if (elFed) {
      const statusFederacao = socio.federacao || "Não Regularizada";
      elFed.innerText = statusFederacao;
      const cardFederacao = elFed.closest(".info-card");
      if (cardFederacao) {
        if (statusFederacao.toLowerCase() === "não regularizada") {
          cardFederacao.classList.add("card-alerta-vermelho");
        } else {
          cardFederacao.classList.remove("card-alerta-vermelho");
        }
      }
    }

    const cardMensalidade = document.getElementById("cardMensalidade");
    if (cardMensalidade) {
      const statusH1 = document.getElementById("statusMensalidade");
      const iconMensalidade = document.getElementById("iconeMensalidade");
      const mesReferenciaP = document.getElementById("mesReferencia");
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

      if (mesReferenciaP)
        mesReferenciaP.innerText = `Referente a ${mesesPT[hoje.getMonth()]}`;

      if (pagamento && pagamento.estado === "Pago") {
        cardMensalidade.classList.remove("pendente", "card-alerta-vermelho");
        if (statusH1) {
          statusH1.className = "status-pago";
          statusH1.innerText = "PAGO";
        }
        if (iconMensalidade)
          iconMensalidade.innerHTML =
            "<i class='bx bx-check-shield' style='color: #4ade80;'></i>";
      } else {
        cardMensalidade.classList.add("pendente", "card-alerta-vermelho");
        if (statusH1) {
          statusH1.className = "status-em-divida";
          statusH1.innerText = "N PAGO";
        }
        if (iconMensalidade)
          iconMensalidade.innerHTML =
            "<i class='bx bx-error-circle' style='color: #ff4d4d;'></i>";
      }
    }

    loginSection.classList.add("hidden");
    portalSection.classList.remove("hidden");

    verificarRegulamento(socio);
    verificarNecessidadeDeNotificacoes(socio.id);
    buscarProximaAula(socio.id); // 🥊 AGORA FUNCIONA!

    const diaAtual = hoje.getDate();
    if ((!pagamento || pagamento.estado !== "Pago") && diaAtual > 8) {
      const modalCobranca = document.getElementById("modalCobranca");
      if (modalCobranca)
        setTimeout(() => modalCobranca.classList.remove("hidden"), 500);
    }

    buscarNotificacoes(socio.id);
  }

  // 🥊 FUNÇÃO DE VERIFICAÇÃO DO REGULAMENTO (MANTIDA NO SCOPE LOCAL)
  function verificarRegulamento(socio) {
    const modalReg = document.getElementById("modalRegulamento");
    const btnFecharX = document.getElementById("btnFecharRegulamentoX");
    const btnAceitar = document.getElementById("btnFecharRegulamento");
    const checkAceite = document.getElementById("checkAceiteRegulamento");
    const containerCheck = document.getElementById(
      "containerAceiteRegulamento",
    );

    if (!socio.regulamento_aceite) {
      modalReg?.classList.remove("hidden");
      if (btnFecharX) btnFecharX.classList.add("hidden");
      if (containerCheck) containerCheck.classList.remove("hidden");
      if (btnAceitar) {
        btnAceitar.disabled = true;
        btnAceitar.classList.add("btn-disabled");
        checkAceite?.addEventListener("change", (e) => {
          btnAceitar.disabled = !e.target.checked;
          btnAceitar.classList.toggle("btn-disabled", !e.target.checked);
          btnAceitar.innerText = e.target.checked
            ? "Aceitar Regulamento"
            : "Li e Compreendi!";
        });
      }
    } else {
      if (containerCheck) containerCheck.classList.add("hidden");
      if (btnFecharX) btnFecharX.classList.remove("hidden");
    }
  }

  async function tentarAutoLogin() {
    const idGuardado = localStorage.getItem("bogas_atleta_id");
    if (!idGuardado) return;
    loginSection.classList.add("hidden");
    try {
      const { data: socio, error } = await supabase
        .from("socios")
        .select("*")
        .eq("id", idGuardado)
        .maybeSingle();
      if (error || !socio) {
        localStorage.removeItem("bogas_atleta_id");
        loginSection.classList.remove("hidden");
        return;
      }
      await iniciarPortalParaAtleta(socio);
    } catch (err) {
      localStorage.removeItem("bogas_atleta_id");
      loginSection.classList.remove("hidden");
    }
  }
  tentarAutoLogin();

  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailInserido = document
        .getElementById("emailAtletaLogin")
        .value.trim();
      const passInserida = document
        .getElementById("passAtletaLogin")
        .value.trim();
      const btnSubmit = formLogin.querySelector("button[type='submit']");
      const textoOriginal = btnSubmit.innerHTML;
      btnSubmit.innerHTML =
        "A verificar... <i class='bx bx-loader-alt bx-spin'></i>";
      btnSubmit.disabled = true;

      try {
        const { data: socio, error } = await supabase
          .from("socios")
          .select("*")
          .ilike("email", emailInserido)
          .maybeSingle();
        if (error) throw error;
        if (!socio) {
          mostrarAviso(
            "Acesso Negado",
            "Este email não consta na nossa base de dados.",
            "erro",
          );
          return;
        }
        let passCorreta = socio.password
          ? passInserida === socio.password
          : passInserida === socio.telemovel?.toString().trim();
        if (!passCorreta) {
          mostrarAviso(
            "Acesso Negado",
            "Palavra-passe incorreta. Tenta novamente.",
            "erro",
          );
          return;
        }
        await iniciarPortalParaAtleta(socio);
      } catch (erro) {
        mostrarAviso(
          "Erro de Sistema",
          "Não foi possível ligar ao servidor.",
          "erro",
        );
      } finally {
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
      }
    });
  }

  const modalConfirmLogout = document.getElementById("modalConfirmLogout");
  if (btnSair) {
    btnSair.addEventListener("click", () => {
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
    ?.addEventListener("click", (e) => {
      localStorage.removeItem("bogas_atleta_id");
      window.location.replace("index.html");
    });

  document.getElementById("btnRegulamento")?.addEventListener("click", () => {
    document.getElementById("modalRegulamento")?.classList.remove("hidden");
  });
  document
    .getElementById("btnFecharRegulamentoX")
    ?.addEventListener("click", () => {
      document.getElementById("modalRegulamento")?.classList.add("hidden");
    });
  document
    .getElementById("btnFecharRegulamento")
    ?.addEventListener("click", async () => {
      const checkAceite = document.getElementById("checkAceiteRegulamento");
      const btnConfirma = document.getElementById("btnFecharRegulamento");
      const containerCheck = document.getElementById(
        "containerAceiteRegulamento",
      );
      const modalReg = document.getElementById("modalRegulamento");

      if (containerCheck && !containerCheck.classList.contains("hidden")) {
        if (checkAceite && checkAceite.checked) {
          btnConfirma.innerHTML =
            "A assinar... <i class='bx bx-loader-alt bx-spin'></i>";
          btnConfirma.disabled = true;
          try {
            const { error } = await supabase.rpc("assinar_regulamento", {
              atleta_id: atletaLogadoId,
            });
            if (error) throw error;
            mostrarAviso("Regulamento assinado com sucesso.", "sucesso");
            modalReg?.classList.add("hidden");
            containerCheck.classList.add("hidden");
            document
              .getElementById("btnFecharRegulamentoX")
              ?.classList.remove("hidden");
            btnConfirma.innerHTML = "Li e Compreendi!";
            btnConfirma.disabled = false;
          } catch (err) {
            mostrarAviso("Erro de Conexão", `Erro: ${err.message}`, "erro");
            btnConfirma.disabled = false;
          }
        }
      } else {
        modalReg?.classList.add("hidden");
      }
    });

  // =========================================================================
  // --- HISTÓRICO DE PAGAMENTOS (COM CORREÇÃO DE DATA E ESTADO) ---
  // =========================================================================
  const btnVerPagamentos = document.getElementById("btnVerPagamentos");
  const modalHistorico = document.getElementById("modalHistorico");
  const listaPagamentosAtleta = document.getElementById(
    "listaPagamentosAtleta",
  );

  if (btnVerPagamentos) {
    btnVerPagamentos.addEventListener("click", async () => {
      if (!atletaLogadoId) return;
      listaPagamentosAtleta.innerHTML =
        '<tr><td colspan="4" style="text-align:center;">A consultar...</td></tr>';
      modalHistorico.classList.remove("hidden");
      try {
        const { data, error } = await supabase
          .from("mensalidades")
          .select("*")
          .eq("socio_id", atletaLogadoId)
          .order("mes_ano", { ascending: false });
        if (error) throw error;

        listaPagamentosAtleta.innerHTML = data.length
          ? data
              .map((p) => {
                const dataRaw = p.mes_ano || "";
                let dataDisplay = dataRaw;

                // 🥊 1. FORMATO ANO / MÊS (2026/05)
                if (dataRaw.includes("-")) {
                  const [ano, mes] = dataRaw.split("-");
                  dataDisplay = `${ano}/${mes}`;
                } else if (dataRaw.includes("/")) {
                  const [dia, mes, ano] = dataRaw.split("/");
                  dataDisplay = `${ano}/${mes}`;
                }

                // 🥊 2. SIMPLIFICAÇÃO DO TIPO
                const eAula =
                  p.tipo === "Aula Particular" || dataRaw.length > 7;
                const tipoDisplay = eAula ? "PT" : "Mensal";

                // 🥊 3. ETIQUETA COM PREFIXO
                const labelFinal = eAula ? `${dataDisplay}` : dataDisplay;
                const rowClass =
                  p.estado === "Pendente" ? "linha-pendente-alerta" : "";

                return `
          <tr class="${rowClass}">
            <td>${labelFinal}</td>
            <td style="font-weight: 600;">${tipoDisplay}</td>
            <td style="font-weight: bold;">${p.valor} €</td>
            <td><span class="status-badge ${p.estado.toLowerCase()}">${p.estado.toUpperCase()}</span></td>
          </tr>`;
              })
              .join("")
          : '<tr><td colspan="4">Sem registos.</td></tr>';
      } catch (err) {
        listaPagamentosAtleta.innerHTML =
          '<tr><td colspan="4">Erro ao carregar histórico.</td></tr>';
      }
    });
  }
  document
    .getElementById("btnFecharHistorico")
    ?.addEventListener("click", () => modalHistorico.classList.add("hidden"));

  // --- ALTERAR PASSWORD ---
  const btnAbrirModalPass = document.getElementById("btnAbrirModalPass");
  const modalPass = document.getElementById("modalPass");
  const formAlterarPass = document.getElementById("formAlterarPass");
  if (btnAbrirModalPass) {
    btnAbrirModalPass.addEventListener("click", () =>
      modalPass.classList.remove("hidden"),
    );
  }
  document
    .getElementById("btnFecharModalPass")
    ?.addEventListener("click", () => modalPass.classList.add("hidden"));
  if (formAlterarPass) {
    formAlterarPass.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nova = document.getElementById("novaPass").value.trim();
      const confirma = document.getElementById("confirmaNovaPass").value.trim();
      if (nova.length < 4 || nova !== confirma) {
        mostrarAviso("Erro", "Verifica a password.", "erro");
        return;
      }
      try {
        const { error } = await supabase
          .from("socios")
          .update({ password: nova })
          .eq("id", atletaLogadoId);
        if (error) throw error;
        mostrarAviso("Sucesso", "Password alterada!", "sucesso");
        modalPass.classList.add("hidden");
        formAlterarPass.reset();
      } catch (err) {
        mostrarAviso("Erro", "Falha ao alterar.", "erro");
      }
    });
  }

  document
    .getElementById("btnFecharCobranca")
    ?.addEventListener("click", () => {
      document.getElementById("modalCobranca").classList.add("hidden");
      verificarNecessidadeDeNotificacoes(atletaLogadoId);
    });

  // --- APAGAR NOTIFICAÇÕES ---
  window.apagarNotificacao = function (id) {
    notificacaoParaApagarId = id;
    document.getElementById("modalConfirmarApagar").classList.remove("hidden");
  };
  document
    .getElementById("btnCancelarApagar")
    ?.addEventListener("click", () => {
      document.getElementById("modalConfirmarApagar").classList.add("hidden");
    });
  document
    .getElementById("btnConfirmarApagar")
    ?.addEventListener("click", async () => {
      if (!notificacaoParaApagarId) return;
      try {
        await supabase
          .from("notificacoes")
          .delete()
          .eq("id", notificacaoParaApagarId);
        mensagensAtleta = mensagensAtleta.filter(
          (m) => m.id != notificacaoParaApagarId,
        );
        renderizarNotificacoes();
        atualizarBadge();
        mostrarAviso("Mensagem Apagada", "Removida.", "sucesso");
      } catch (err) {
        mostrarAviso("Erro", "Erro ao apagar.", "erro");
      } finally {
        document.getElementById("modalConfirmarApagar").classList.add("hidden");
      }
    });
  // =========================================================================
  // --- PUSH NOTIFICATIONS (BLINDAGEM TOTAL) ---
  // =========================================================================
  const PUBLIC_VAPID_KEY =
    "BDlSFCtWMO00daEMrL5sLutOo9iw7KfQ_KlxFvL24zhmvPcA2Cn-M8qez3pJgQQzgzeCi8Pwho7s8Ii1-_cDvXo";

  // 🥊 GOLPE DEFENSIVO: Remove a "parede invisível" dos alertas que bloqueia os botões no telemóvel
  const toastContainer = document.getElementById("toast-container");
  if (toastContainer) toastContainer.style.pointerEvents = "none";

  async function verificarNecessidadeDeNotificacoes(socioId) {
    const box = document.getElementById("boxNotificacoes");
    if (!box) return;
    try {
      const registo = await navigator.serviceWorker.ready;
      const subAtual = await registo.pushManager.getSubscription();
      const permissao = Notification.permission;

      if (subAtual && permissao === "granted") {
        box.classList.add("hidden");
      } else {
        setTimeout(() => {
          box.classList.remove("hidden");
          if (permissao === "default") {
            const modalAviso = document.getElementById(
              "modalAvisoNotificacoes",
            );
            if (modalAviso) {
              modalAviso.style.zIndex = "9999"; // Força o modal para a frente de tudo
              modalAviso.classList.remove("hidden");
            }
          }
        }, 1200);
      }
    } catch (err) {
      console.log("Notificações não suportadas pelo browser atual.");
    }
  }

  const executarAtivacaoPush = async () => {
    try {
      const btnAtivar = document.getElementById("btnAceitarNotificacoesModal");
      if (btnAtivar)
        btnAtivar.innerHTML =
          "A gerar chave... <i class='bx bx-loader-alt bx-spin'></i>";

      const permissao = await Notification.requestPermission();

      if (permissao === "granted") {
        const registo = await navigator.serviceWorker.ready;
        const subAntiga = await registo.pushManager.getSubscription();
        if (subAntiga) await subAntiga.unsubscribe();

        const sub = await registo.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY),
        });

        await supabase.from("push_subscriptions").insert([
          {
            socio_id: Number(atletaLogadoId),
            subscricao: JSON.stringify(sub),
          },
        ]);

        const box = document.getElementById("boxNotificacoes");
        if (box) box.style.display = "none";
        mostrarAviso("Ossss!", "Alertas ativados com sucesso.", "sucesso");
      } else {
        mostrarAviso(
          "Aviso",
          "Permissão para alertas recusada no telemóvel.",
          "erro",
        );
      }
    } catch (erro) {
      mostrarAviso("Erro", "O sistema bloqueou o pedido.", "erro");
    } finally {
      // 🥊 GARANTIA MÁXIMA DE FECHO: O modal fecha SEMPRE, quer dê erro ou sucesso!
      const modalAviso = document.getElementById("modalAvisoNotificacoes");
      if (modalAviso) modalAviso.classList.add("hidden");

      const btnAtivar = document.getElementById("btnAceitarNotificacoesModal");
      if (btnAtivar) btnAtivar.innerHTML = "Ativar Agora";
    }
  };

  function urlB64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i)
      outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  const protegerEAtivarBotao = (btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    const eTelemovel = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const estaNaApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    if (eTelemovel && !estaNaApp) {
      btn.disabled = true;
      btn.style.opacity = "0.6";
      btn.style.cursor = "not-allowed";
      btn.innerHTML = "<i class='bx bx-download'></i> Instala a App";
      btn.parentElement.onclick = (e) => {
        if (btn.disabled)
          mostrarAviso("Atenção", "Instala a aplicação primeiro!", "erro");
      };
    } else {
      // 🥊 Ataque direto: Substitui o AddEventListener por um onclick blindado
      btn.onclick = executarAtivacaoPush;
    }
  };

  protegerEAtivarBotao("btnAtivarNotificacoes");
  protegerEAtivarBotao("btnAceitarNotificacoesModal");

  // 🥊 BOTÃO MAIS TARDE: Ligação direta e blindada para garantir o fecho
  const btnRecusar = document.getElementById("btnRecusarNotificacoes");
  if (btnRecusar) {
    btnRecusar.onclick = () => {
      document
        .getElementById("modalAvisoNotificacoes")
        ?.classList.add("hidden");
    };
  }
});

// =========================================================================
// --- SISTEMA DE CAIXA DE MENSAGENS E TOAST ---
// =========================================================================
function mostrarAviso(titulo, mensagem, tipo = "sucesso") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<i class='bx ${tipo === "sucesso" ? "bx-check-circle" : "bx-error-circle"}'></i><div class="toast-content"><h4>${titulo}</h4><p>${mensagem}</p></div>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

async function buscarNotificacoes(userId) {
  try {
    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("socio_id", userId)
      .order("created_at", { ascending: false });
    mensagensAtleta = data || [];
    atualizarBadge();
    renderizarNotificacoes();
  } catch (err) {}
}

function atualizarBadge() {
  const badge = document.getElementById("badgeNotificacoes");
  if (!badge) return;
  const count = mensagensAtleta.filter((m) => !m.lida).length;
  if (count > 0) {
    badge.innerText = count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function renderizarNotificacoes() {
  const lista = document.getElementById("listaNotificacoes");
  if (!lista) return;
  lista.innerHTML = mensagensAtleta.length
    ? mensagensAtleta
        .map(
          (m) => `
    <div class="notif-item ${m.lida ? "lida" : ""}" data-id="${m.id}">
      <div class="notif-info"><h4>${m.titulo}</h4><p>${m.mensagem}</p><span class="notif-time">${new Date(m.created_at).toLocaleString("pt-PT")}</span></div>
      <button class="btn-delete-notif" data-id="${m.id}"><i class='bx bx-trash'></i></button>
    </div>`,
        )
        .join("")
    : '<p class="notif-empty">Sem mensagens.</p>';

  document
    .querySelectorAll(".btn-delete-notif")
    .forEach((btn) =>
      btn.addEventListener("click", (e) =>
        window.apagarNotificacao(e.currentTarget.getAttribute("data-id")),
      ),
    );
}

document
  .getElementById("btnVerNotificacoes")
  ?.addEventListener("click", async () => {
    document.getElementById("modalNotificacoes")?.classList.remove("hidden");
    const naoLidas = mensagensAtleta.filter((m) => !m.lida).map((m) => m.id);
    if (naoLidas.length > 0) {
      await supabase
        .from("notificacoes")
        .update({ lida: true })
        .in("id", naoLidas);
      mensagensAtleta.forEach((m) => (m.lida = true));
      atualizarBadge();
      renderizarNotificacoes();
    }
  });
document
  .getElementById("btnFecharNotificacoes")
  ?.addEventListener("click", () =>
    document.getElementById("modalNotificacoes")?.classList.add("hidden"),
  );

// =========================================================================
// 🥊 GESTÃO DE AULAS PARTICULARES (Portal do Sócio)
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  const modalAula = document.getElementById("modalAulaParticular");
  const btnAbrirModal = document.getElementById("btnAbrirModalParticular");
  const btnFecharModal = document.getElementById("btnFecharModalParticular");
  const formAula = document.getElementById("formAulaParticular");
  const inputData = document.getElementById("dataParticular");
  const inputHora = document.getElementById("horaParticular");

  if (btnAbrirModal) {
    btnAbrirModal.addEventListener("click", () => {
      modalAula.classList.remove("hidden");
      inputData.setAttribute("min", new Date().toISOString().split("T")[0]);
    });
  }

  if (btnFecharModal) {
    btnFecharModal.addEventListener("click", () => {
      modalAula.classList.add("hidden");
      formAula.reset();
    });
  }

  formAula?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const dataSelecionada = new Date(inputData.value);
    const diaSemana = dataSelecionada.getDay();
    const horaSelecionada = parseInt(inputHora.value.split(":")[0]);

    if (diaSemana >= 1 && diaSemana <= 5) {
      mostrarAviso("Indisponível", "Apenas aos fins de semana.", "erro");
      return;
    }
    if (
      (diaSemana === 0 && horaSelecionada < 10) ||
      (diaSemana === 6 && horaSelecionada < 13)
    ) {
      mostrarAviso("Fora de Horas", "Verifica o horário permitido.", "erro");
      return;
    }

    const btnSubmit = document.getElementById("btnPedirAula");
    btnSubmit.innerHTML =
      "A enviar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnSubmit.disabled = true;

    try {
      const socioIdAtual =
        atletaLogadoId || localStorage.getItem("bogas_atleta_id");
      await supabase.from("aulas_particulares").insert([
        {
          socio_id: socioIdAtual,
          data_aula: inputData.value,
          hora_aula: inputHora.value,
          estado: "Pendente",
        },
      ]);
      await supabase.from("notificacoes").insert([
        {
          socio_id: socioIdAtual,
          titulo: "Aula Pendente ⏳",
          mensagem: `Pedido para dia ${inputData.value} enviado.`,
          lida: false,
        },
      ]);

      mostrarAviso("Pedido Enviado", "Aguardar confirmação!", "sucesso");
      buscarProximaAula(socioIdAtual); // 🥊 AGORA CHAMA A FUNÇÃO GLOBAL!
      modalAula.classList.add("hidden");
      formAula.reset();
    } catch (erro) {
      mostrarAviso("Erro", erro.message, "erro");
    } finally {
      btnSubmit.innerHTML = "Pedir Aprovação";
      btnSubmit.disabled = false;
    }
  });
});

// No ficheiro JS do Portal do Atleta:
export function renderizarHistorico(lista) {
  const tabela = document.getElementById("tabelaCorpoHistorico");
  if (!tabela) return;
  tabela.innerHTML = "";

  lista.forEach((m) => {
    const tr = document.createElement("tr");
    const dataRaw = m.mes_ano || "";
    let dataDisplay = dataRaw;

    if (dataRaw.includes("-")) {
      const [ano, mes] = dataRaw.split("-");
      dataDisplay = `${ano}/${mes}`;
    } else if (dataRaw.includes("/")) {
      const [dia, mes, ano] = dataRaw.split("/");
      dataDisplay = `${ano}/${mes}`;
    }

    const eAula = m.tipo === "Aula Particular" || dataRaw.length > 7;
    const tipoDisplay = eAula ? "PT" : "Mensal";
    const labelFinal = eAula ? `Aula: ${dataDisplay}` : dataDisplay;

    if (m.estado === "Pendente") {
      tr.classList.add("linha-pendente-alerta");
    }

    tr.innerHTML = `
      <td>${labelFinal}</td>
      <td style="font-weight: 600;">${tipoDisplay}</td>
      <td style="font-weight: bold;">${m.valor}€</td>
      <td><span class="status-badge ${m.estado.toLowerCase()}">${m.estado.toUpperCase()}</span></td>
    `;
    tabela.appendChild(tr);
  });
}
