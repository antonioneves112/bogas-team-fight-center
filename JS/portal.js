/* JS/portal.js - PORTAL DO ATLETA
 *
 * SEGURANÇA: o portal NUNCA lê tabelas diretamente. Tudo passa pelas funções
 * portal_* da base de dados (supabase/migracoes/01_preparar.sql), que:
 *   - verificam a password no servidor (hash bcrypt);
 *   - devolvem um token de sessão aleatório (guardado no localStorage);
 *   - só devolvem/alteram dados do atleta dono do token.
 */
import { supabase } from "./supabase.js";
import { mostrarAviso } from "./toast.js";
import {
  CHAVE_TOKEN_PORTAL,
  PUBLIC_VAPID_KEY,
  WEBHOOK_MAKE_URL,
  EMAIL_ADMIN,
} from "./config.js";
import {
  escapeHTML,
  MESES_PT,
  dataLocalISO,
  mesLocalISO,
  urlB64ToUint8Array,
  mostrar,
} from "./helpers.js";

let atletaLogadoObj = null;
let notificacaoParaApagarId = null;
let mensagensAtleta = [];
let eventoInstalacaoGuardado = null;

const MENSAGENS_ERRO = {
  SESSAO_INVALIDA: "A tua sessão terminou. Entra novamente.",
  DEMASIADAS_TENTATIVAS: "Demasiadas tentativas falhadas. Aguarda 15 minutos.",
  SO_FIM_DE_SEMANA: "Apenas aos fins de semana.",
  FORA_DE_HORAS: "Verifica o horário permitido.",
  DATA_PASSADA: "Escolhe uma data a partir de hoje.",
  PASSWORD_CURTA: "A password tem de ter pelo menos 4 caracteres.",
};

function codigoErro(err) {
  const msg = err?.message || "";
  return Object.keys(MENSAGENS_ERRO).find((c) => msg.includes(c)) || null;
}

const lerToken = () => localStorage.getItem(CHAVE_TOKEN_PORTAL);

// Chama uma função portal_* com o token da sessão; lança erro se falhar.
async function rpcPortal(nome, params = {}) {
  const { data, error } = await supabase.rpc(nome, { p_token: lerToken(), ...params });
  if (error) {
    if (codigoErro(error) === "SESSAO_INVALIDA") terminarSessaoLocal(true);
    throw error;
  }
  return data;
}

// =========================================================================
// PWA (banner de instalação)
// =========================================================================
function inicializarPWA_Flutuante() {
  const banner = document.getElementById("pwa-install-banner");
  const btnInstall = document.getElementById("pwa-install-btn");
  const btnClose = document.getElementById("pwa-close-btn");
  const iosModal = document.getElementById("ios-install-modal");
  const closeIosModal = document.getElementById("close-ios-modal");

  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (estaNaApp || localStorage.getItem("bogas_pwa_dispensada") === "true") {
    banner?.classList.add("hidden");
    return;
  }

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacaoGuardado = e;
    if (banner) setTimeout(() => banner.classList.add("show"), 1000);
  });

  if (isIOS && banner) setTimeout(() => banner.classList.add("show"), 2000);

  btnClose?.addEventListener("click", () => {
    banner.classList.remove("show");
    localStorage.setItem("bogas_pwa_dispensada", "true");
  });

  btnInstall?.addEventListener("click", async () => {
    if (isIOS) {
      banner.classList.remove("show");
      iosModal?.classList.remove("hidden");
      return;
    }
    if (!eventoInstalacaoGuardado) return;
    try {
      await eventoInstalacaoGuardado.prompt();
      const { outcome } = await eventoInstalacaoGuardado.userChoice;
      if (outcome === "accepted") banner.classList.remove("show");
    } catch (erro) {
      console.error("Erro na instalação:", erro);
    } finally {
      eventoInstalacaoGuardado = null;
    }
  });

  closeIosModal?.addEventListener("click", () => iosModal?.classList.add("hidden"));

  window.addEventListener("appinstalled", () => {
    banner?.classList.remove("show");
    eventoInstalacaoGuardado = null;
  });
}

inicializarPWA_Flutuante();

// =========================================================================
// RENDERIZAÇÃO
// =========================================================================
function renderizarProximaAula(aula) {
  const elTexto = document.getElementById("atletaProximaAula");
  const elBadge = document.getElementById("statusProximaAula");
  if (!elTexto || !elBadge) return;

  if (aula) {
    const [, mes, dia] = String(aula.data_aula).split("-");
    elTexto.innerHTML = `${escapeHTML(dia)}/${escapeHTML(mes)}<br><span class="hora-destaque">${escapeHTML(String(aula.hora_aula).substring(0, 5))}</span>`;
    elBadge.classList.remove("hidden");
    elBadge.innerText = aula.estado;
    elBadge.className =
      aula.estado === "Aceite" ? "badge-status status-apto" : "badge-status status-nao-apto";
  } else {
    elTexto.innerText = "Nenhuma agendada";
    elBadge.classList.add("hidden");
  }
}

function atualizarBadge() {
  const badge = document.getElementById("badgeNotificacoes");
  if (!badge) return;
  const count = mensagensAtleta.filter((m) => !m.lida).length;
  badge.innerText = count;
  mostrar(badge, count > 0);
}

function renderizarNotificacoes() {
  const lista = document.getElementById("listaNotificacoes");
  if (!lista) return;

  lista.innerHTML = mensagensAtleta.length
    ? mensagensAtleta
        .map(
          (m) => `
    <div class="notif-item ${m.lida ? "lida" : ""}" data-id="${escapeHTML(m.id)}">
      <div class="notif-info"><h4>${escapeHTML(m.titulo)}</h4><p>${escapeHTML(m.mensagem)}</p><span class="notif-time">${escapeHTML(new Date(m.created_at).toLocaleString("pt-PT"))}</span></div>
      <button class="btn-delete-notif" data-id="${escapeHTML(m.id)}"><i class='bx bx-trash'></i></button>
    </div>`,
        )
        .join("")
    : '<p class="notif-empty">Sem mensagens.</p>';
}

function renderizarPortal(resumo) {
  const socio = resumo.socio;
  atletaLogadoObj = socio;
  mensagensAtleta = resumo.notificacoes || [];

  const elNome = document.getElementById("atletaNome");
  if (elNome) elNome.innerText = socio.nome;

  const elFoto = document.getElementById("atletaFoto");
  if (elFoto && socio.foto_url) elFoto.src = socio.foto_url;

  const elMod = document.getElementById("atletaModalidade");
  if (elMod) elMod.innerHTML = `<i class='bx bx-medal'></i> ${escapeHTML(socio.modalidade || "---")}`;

  const elDataInsc = document.getElementById("atletaDataInscricao");
  if (elDataInsc)
    elDataInsc.innerText = socio.data_inscricao
      ? socio.data_inscricao.split("-").reverse().join("/")
      : "--/--/----";

  const elGrad = document.getElementById("atletaGraduacao");
  const badgeGrad = document.getElementById("statusAptidao");
  const elDataUltimaGrad = document.getElementById("labelUltimaGrad");
  if (elGrad) elGrad.innerText = socio.graduacao || "---";
  badgeGrad?.classList.add("hidden");
  if (elDataUltimaGrad) {
    const semGraduacao =
      !socio.graduacao || socio.graduacao === "N/A" || socio.graduacao === "Não Aplicável";
    elDataUltimaGrad.innerText = semGraduacao
      ? "Última: N/A"
      : socio.data_ultima_graduacao
        ? `Última: ${socio.data_ultima_graduacao.split("-").reverse().join("/")}`
        : "Última: --/--/----";
  }

  const elFed = document.getElementById("atletaFederacao");
  if (elFed) {
    const estadoFedRaw = socio.federacao || socio.estado_federacao || "Não Regularizada";
    const estadoFed = estadoFedRaw === "---" ? "Não Regularizada" : estadoFedRaw;
    elFed.innerText = estadoFed;
    elFed
      .closest(".info-card")
      ?.classList.toggle(
        "card-alerta-vermelho",
        estadoFed === "Não Regularizada" || estadoFed === "Não Regularizado",
      );
  }

  // ---- Estado da mensalidade (mesma regra de negócio de antes) ----
  const hoje = new Date();
  const faturaMensalidade = (resumo.faturas_mes || []).find(
    (p) => !p.tipo || p.tipo === "Mensalidade" || p.tipo === "Rendimento",
  );
  const isPTOnly =
    socio.modalidade === "Aulas Particulares" || socio.modalidade === "Aula Particular";
  const isParceria =
    socio.modalidade === "Rendimento" || (socio.nome || "").toUpperCase().includes("GYM");

  let statusTexto = "PAGO";
  let tipoDivida = "";
  if (resumo.tem_aula_por_pagar) {
    statusTexto = "AULA N PAGA";
    tipoDivida = "aula";
  } else if (
    !isPTOnly &&
    !isParceria &&
    (!faturaMensalidade || (faturaMensalidade.estado || "").trim().toLowerCase() === "pendente")
  ) {
    statusTexto = "N PAGA";
    tipoDivida = "mensalidade";
  }
  const isDivida = tipoDivida !== "";

  const labelMesRef = document.getElementById("mesReferencia");
  if (labelMesRef) labelMesRef.innerText = `Referente a ${MESES_PT[hoje.getMonth()]}`;

  const cardMensalidade = document.getElementById("cardMensalidade");
  const statusH1 = document.getElementById("statusMensalidade");
  const iconMensalidade = document.getElementById("iconeMensalidade");
  if (cardMensalidade) {
    cardMensalidade.classList.toggle("pendente", isDivida);
    cardMensalidade.classList.toggle("card-alerta-vermelho", isDivida);
    if (statusH1) {
      statusH1.className = isDivida ? "status-em-divida" : "status-pago";
      statusH1.innerText = statusTexto;
    }
    if (iconMensalidade)
      iconMensalidade.innerHTML = isDivida
        ? "<i class='bx bx-error-circle icon-danger'></i>"
        : "<i class='bx bx-check-shield icon-success'></i>";
  }

  if (isDivida && hoje.getDate() > 8) {
    const modalCobranca = document.getElementById("modalCobranca");
    if (modalCobranca) {
      const tituloShame = modalCobranca.querySelector(".shame-title");
      const descShame = modalCobranca.querySelector(".shame-description");
      if (tipoDivida === "mensalidade") {
        tituloShame.innerText = "MENSALIDADE PENDENTE";
        descShame.innerHTML = `Os nossos registos indicam que tens a tua mensalidade em atraso.<br><br>
                <strong class="text-accent">Regulariza a tua situação com o treinador o mais breve possível para continuares a treinar.</strong>`;
      } else {
        tituloShame.innerText = "AULA PARTICULAR PENDENTE";
        descShame.innerHTML = `Os nossos registos indicam que tens uma aula particular por liquidar.<br><br>
                <strong class="text-accent">Por favor, regulariza o pagamento com o mestre para manteres a tua conta em dia.</strong>`;
      }
      setTimeout(() => modalCobranca.classList.remove("hidden"), 500);
    }
  }

  verificarRegulamento(socio);
  atualizarBadge();
  renderizarNotificacoes();
  renderizarProximaAula(resumo.proxima_aula);
  verificarNecessidadeDeNotificacoes();
}

function verificarRegulamento(socio) {
  const modalReg = document.getElementById("modalRegulamento");
  const btnFecharX = document.getElementById("btnFecharRegulamentoX");
  const btnAceitar = document.getElementById("btnFecharRegulamento");
  const containerCheck = document.getElementById("containerAceiteRegulamento");

  if (!socio.regulamento_aceite) {
    modalReg?.classList.remove("hidden");
    btnFecharX?.classList.add("hidden");
    containerCheck?.classList.remove("hidden");
    if (btnAceitar) {
      btnAceitar.disabled = true;
      btnAceitar.classList.add("btn-disabled");
    }
  } else {
    containerCheck?.classList.add("hidden");
    btnFecharX?.classList.remove("hidden");
  }
}

async function carregarPortal() {
  const resumo = await rpcPortal("portal_resumo", {
    p_mes: mesLocalISO(),
    p_hoje: dataLocalISO(),
  });
  renderizarPortal(resumo);
  return resumo;
}

// Atualiza só a próxima aula e as mensagens (sem voltar a abrir modais de cobrança).
async function atualizarAulaENotificacoes() {
  const resumo = await rpcPortal("portal_resumo", {
    p_mes: mesLocalISO(),
    p_hoje: dataLocalISO(),
  });
  mensagensAtleta = resumo.notificacoes || [];
  atualizarBadge();
  renderizarNotificacoes();
  renderizarProximaAula(resumo.proxima_aula);
}

// =========================================================================
// SESSÃO
// =========================================================================
function terminarSessaoLocal(expirou = false) {
  localStorage.removeItem(CHAVE_TOKEN_PORTAL);
  atletaLogadoObj = null;
  mensagensAtleta = [];
  mostrar(document.getElementById("portal-section"), false);
  mostrar(document.getElementById("login-section"), true);
  if (expirou) mostrarAviso("Sessão terminada", MENSAGENS_ERRO.SESSAO_INVALIDA, "erro");
}

// =========================================================================
// NOTIFICAÇÕES PUSH
// =========================================================================
async function verificarNecessidadeDeNotificacoes() {
  const box = document.getElementById("boxNotificacoes");
  const statusText = document.getElementById("statusNotificacoesDispositivo");
  if (!box || !("serviceWorker" in navigator) || !("Notification" in window)) return;

  try {
    const registo = await navigator.serviceWorker.ready;
    let subAtual = await registo.pushManager.getSubscription();
    const permissao = Notification.permission;
    let temSubscricaoNaBD = await rpcPortal("portal_tem_push");

    if (permissao === "granted" && !temSubscricaoNaBD) {
      if (!subAtual) {
        subAtual = await registo.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY),
        });
      }
      await rpcPortal("portal_guardar_push", { p_subscricao: JSON.stringify(subAtual) });
      temSubscricaoNaBD = true;
    }

    if (subAtual && permissao === "granted" && temSubscricaoNaBD) {
      box.classList.add("hidden");
      if (statusText) {
        statusText.innerText = "Ativo";
        statusText.className = "status-ativo";
      }
      return;
    }

    if (statusText) {
      statusText.innerText = "Desativado";
      statusText.className = "status-desativado";
    }
    setTimeout(() => {
      if (permissao !== "granted") box.classList.remove("hidden");
      if (permissao === "default" && !sessionStorage.getItem("avisoPushMostrado")) {
        const modalAviso = document.getElementById("modalAvisoNotificacoes");
        if (modalAviso) {
          modalAviso.classList.remove("hidden");
          sessionStorage.setItem("avisoPushMostrado", "true");
        }
      }
    }, 1200);
  } catch (err) {
    console.warn("Notificações push:", err);
  }
}

async function executarAtivacaoPush() {
  const btnAtivar = document.getElementById("btnAceitarNotificacoesModal");
  try {
    if (btnAtivar) btnAtivar.innerHTML = "A gerar chave... <i class='bx bx-loader-alt bx-spin'></i>";
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      mostrarAviso("Aviso", "Permissão para alertas recusada.", "erro");
      return;
    }
    const registo = await navigator.serviceWorker.ready;
    const subAntiga = await registo.pushManager.getSubscription();
    if (subAntiga) await subAntiga.unsubscribe();
    const sub = await registo.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(PUBLIC_VAPID_KEY),
    });
    await rpcPortal("portal_guardar_push", { p_subscricao: JSON.stringify(sub) });

    document.getElementById("boxNotificacoes")?.classList.add("hidden");
    const statusText = document.getElementById("statusNotificacoesDispositivo");
    if (statusText) {
      statusText.innerText = "Ativo";
      statusText.className = "status-ativo";
    }
    mostrarAviso("Alertas", "Alertas ativados com sucesso.", "sucesso");
  } catch (erro) {
    mostrarAviso("Erro", "O sistema bloqueou o pedido.", "erro");
  } finally {
    document.getElementById("modalAvisoNotificacoes")?.classList.add("hidden");
    if (btnAtivar) btnAtivar.innerHTML = "Ativar Agora";
  }
}

// =========================================================================
// EVENTOS
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const formLogin = document.getElementById("formLoginAtleta");
  const loginSection = document.getElementById("login-section");
  const portalSection = document.getElementById("portal-section");

  document.querySelectorAll(".modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  // ---- Arranque: sessão guardada? ----
  async function tentarAutoLogin() {
    // Sessões do sistema antigo (só o ID do atleta) deixam de ser aceites.
    localStorage.removeItem("bogas_atleta_id");

    if (!lerToken()) {
      mostrar(loginSection, true);
      mostrar(portalSection, false);
      return;
    }
    mostrar(loginSection, false);
    try {
      await carregarPortal();
      mostrar(portalSection, true);
    } catch (err) {
      terminarSessaoLocal(false);
    }
  }
  tentarAutoLogin();

  // ---- Login ----
  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailAtletaLogin").value.trim();
    const pass = document.getElementById("passAtletaLogin").value.trim();
    const btnSubmit = formLogin.querySelector("button[type='submit']");
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = "A verificar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnSubmit.disabled = true;

    try {
      const { data, error } = await supabase.rpc("portal_login", {
        p_email: email,
        p_password: pass,
      });
      if (error) throw error;
      if (!data?.token) {
        mostrarAviso("Acesso Negado", "Email ou palavra-passe incorretos.", "erro");
        return;
      }
      localStorage.setItem(CHAVE_TOKEN_PORTAL, data.token);
      await carregarPortal();
      mostrar(loginSection, false);
      mostrar(portalSection, true);
    } catch (erro) {
      const codigo = codigoErro(erro);
      mostrarAviso(
        codigo ? "Acesso Negado" : "Erro de Sistema",
        codigo ? MENSAGENS_ERRO[codigo] : "Não foi possível ligar ao servidor.",
        "erro",
      );
    } finally {
      btnSubmit.innerHTML = textoOriginal;
      btnSubmit.disabled = false;
    }
  });

  // ---- Logout ----
  const modalConfirmLogout = document.getElementById("modalConfirmLogout");
  document
    .getElementById("btnSairPortal")
    ?.addEventListener("click", () => modalConfirmLogout?.classList.remove("hidden"));
  document
    .getElementById("btnCancelarLogout")
    ?.addEventListener("click", () => modalConfirmLogout?.classList.add("hidden"));
  document.getElementById("btnConfirmarLogout")?.addEventListener("click", async (e) => {
    const btnConfirma = e.currentTarget;
    btnConfirma.innerHTML = "A sair... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirma.disabled = true;
    try {
      await supabase.rpc("portal_logout", { p_token: lerToken() });
    } catch (err) {
      console.warn("Logout:", err);
    }
    terminarSessaoLocal(false);
    modalConfirmLogout?.classList.add("hidden");
    formLogin?.reset();
    btnConfirma.innerHTML = "Sim, Sair";
    btnConfirma.disabled = false;
  });

  // ---- Regulamento ----
  const checkAceite = document.getElementById("checkAceiteRegulamento");
  const btnAceitarReg = document.getElementById("btnFecharRegulamento");
  // Registado UMA vez (antes era adicionado a cada login e acumulava).
  checkAceite?.addEventListener("change", (e) => {
    if (!btnAceitarReg) return;
    btnAceitarReg.disabled = !e.target.checked;
    btnAceitarReg.classList.toggle("btn-disabled", !e.target.checked);
    btnAceitarReg.innerText = e.target.checked ? "Aceitar Regulamento" : "Li e Compreendi!";
  });

  document
    .getElementById("btnRegulamento")
    ?.addEventListener("click", () =>
      document.getElementById("modalRegulamento")?.classList.remove("hidden"),
    );
  document
    .getElementById("btnFecharRegulamentoX")
    ?.addEventListener("click", () =>
      document.getElementById("modalRegulamento")?.classList.add("hidden"),
    );
  btnAceitarReg?.addEventListener("click", async () => {
    const containerCheck = document.getElementById("containerAceiteRegulamento");
    const modalReg = document.getElementById("modalRegulamento");

    if (!containerCheck || containerCheck.classList.contains("hidden")) {
      modalReg?.classList.add("hidden");
      return;
    }
    if (!checkAceite?.checked) return;

    btnAceitarReg.innerHTML = "A assinar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnAceitarReg.disabled = true;
    try {
      await rpcPortal("portal_assinar_regulamento");
      if (atletaLogadoObj) atletaLogadoObj.regulamento_aceite = true;
      mostrarAviso("Regulamento", "Regulamento assinado com sucesso.", "sucesso");
      modalReg?.classList.add("hidden");
      containerCheck.classList.add("hidden");
      document.getElementById("btnFecharRegulamentoX")?.classList.remove("hidden");
      btnAceitarReg.innerHTML = "Li e Compreendi!";
    } catch (err) {
      mostrarAviso("Erro de Conexão", "Não foi possível assinar. Tenta novamente.", "erro");
      btnAceitarReg.innerHTML = "Aceitar Regulamento";
    } finally {
      btnAceitarReg.disabled = false;
    }
  });

  // ---- Histórico de pagamentos ----
  const modalHistorico = document.getElementById("modalHistorico");
  const listaPagamentosAtleta = document.getElementById("listaPagamentosAtleta");
  document.getElementById("btnVerPagamentos")?.addEventListener("click", async () => {
    if (!atletaLogadoObj) return;
    listaPagamentosAtleta.innerHTML =
      '<tr><td colspan="4" class="text-center">A consultar...</td></tr>';
    modalHistorico.classList.remove("hidden");
    try {
      const data = await rpcPortal("portal_historico");
      listaPagamentosAtleta.innerHTML = data.length
        ? data
            .map((p) => {
              const dataRaw = p.mes_ano || "";
              let dataDisplay = dataRaw;
              if (dataRaw.includes("-")) {
                const [ano, mes] = dataRaw.split("-");
                dataDisplay = `${ano}/${mes}`;
              } else if (dataRaw.includes("/")) {
                const [, mes, ano] = dataRaw.split("/");
                dataDisplay = `${ano}/${mes}`;
              }
              const eAula = p.tipo === "Aula Particular" || dataRaw.length > 7;
              const estado = String(p.estado || "");
              return `
          <tr class="${estado === "Pendente" ? "linha-pendente-alerta" : ""}">
            <td>${escapeHTML(dataDisplay)}</td>
            <td class="font-semibold">${eAula ? "PT" : "Mensal"}</td>
            <td class="font-bold">${escapeHTML(p.valor)} €</td>
            <td><span class="status-badge ${escapeHTML(estado.toLowerCase())}">${escapeHTML(estado.toUpperCase())}</span></td>
          </tr>`;
            })
            .join("")
        : '<tr><td colspan="4">Sem registos.</td></tr>';
    } catch (err) {
      listaPagamentosAtleta.innerHTML = '<tr><td colspan="4">Erro ao carregar histórico.</td></tr>';
    }
  });
  document
    .getElementById("btnFecharHistorico")
    ?.addEventListener("click", () => modalHistorico.classList.add("hidden"));

  // ---- Alterar password ----
  const modalPass = document.getElementById("modalPass");
  const formAlterarPass = document.getElementById("formAlterarPass");
  document
    .getElementById("btnAbrirModalPass")
    ?.addEventListener("click", () => modalPass.classList.remove("hidden"));
  document
    .getElementById("btnFecharModalPass")
    ?.addEventListener("click", () => modalPass.classList.add("hidden"));

  formAlterarPass?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnGuardarPass = formAlterarPass.querySelector("button[type='submit']");
    const textoOriginal = btnGuardarPass.innerHTML;
    const nova = document.getElementById("novaPass").value.trim();
    const confirma = document.getElementById("confirmaNovaPass").value.trim();

    if (nova.length < 4 || nova !== confirma) {
      mostrarAviso("Erro", "Verifica a password.", "erro");
      return;
    }
    btnGuardarPass.innerHTML = "A alterar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnGuardarPass.disabled = true;
    try {
      await rpcPortal("portal_alterar_password", { p_nova: nova });
      mostrarAviso("Sucesso", "Password alterada com sucesso!", "sucesso");
      modalPass.classList.add("hidden");
      formAlterarPass.reset();
    } catch (err) {
      const codigo = codigoErro(err);
      mostrarAviso("Erro", codigo ? MENSAGENS_ERRO[codigo] : "Falha ao alterar a palavra-passe.", "erro");
    } finally {
      btnGuardarPass.innerHTML = textoOriginal;
      btnGuardarPass.disabled = false;
    }
  });

  // ---- Modal de cobrança ----
  document.getElementById("btnFecharCobranca")?.addEventListener("click", () => {
    document.getElementById("modalCobranca").classList.add("hidden");
    verificarNecessidadeDeNotificacoes();
  });

  // ---- Notificações (lista) ----
  const modalConfirmarApagar = document.getElementById("modalConfirmarApagar");
  // Delegação de eventos: um só listener para todos os botões de apagar.
  document.getElementById("listaNotificacoes")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn-delete-notif");
    if (!btn) return;
    notificacaoParaApagarId = btn.dataset.id;
    modalConfirmarApagar?.classList.remove("hidden");
  });
  document
    .getElementById("btnCancelarApagar")
    ?.addEventListener("click", () => modalConfirmarApagar?.classList.add("hidden"));
  document.getElementById("btnConfirmarApagar")?.addEventListener("click", async () => {
    if (!notificacaoParaApagarId) return;
    try {
      await rpcPortal("portal_apagar_notificacao", { p_id: Number(notificacaoParaApagarId) });
      mensagensAtleta = mensagensAtleta.filter((m) => String(m.id) !== String(notificacaoParaApagarId));
      renderizarNotificacoes();
      atualizarBadge();
      mostrarAviso("Mensagem Apagada", "Removida.", "sucesso");
    } catch (err) {
      mostrarAviso("Erro", "Erro ao apagar.", "erro");
    } finally {
      notificacaoParaApagarId = null;
      modalConfirmarApagar?.classList.add("hidden");
    }
  });

  document.getElementById("btnVerNotificacoes")?.addEventListener("click", async () => {
    document.getElementById("modalNotificacoes")?.classList.remove("hidden");
    if (!mensagensAtleta.some((m) => !m.lida)) return;
    try {
      await rpcPortal("portal_marcar_lidas");
      mensagensAtleta.forEach((m) => (m.lida = true));
      atualizarBadge();
      renderizarNotificacoes();
    } catch (err) {
      console.warn("Marcar lidas:", err);
    }
  });
  document
    .getElementById("btnFecharNotificacoes")
    ?.addEventListener("click", () =>
      document.getElementById("modalNotificacoes")?.classList.add("hidden"),
    );

  // ---- Botões de ativar alertas ----
  const protegerEAtivarBotao = (btnId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const eTelemovel = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const estaNaApp =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (eTelemovel && !estaNaApp) {
      btn.disabled = true;
      btn.classList.add("btn-disabled");
      btn.innerHTML = "<i class='bx bx-download'></i> Instala a App";
      btn.parentElement.addEventListener("click", () => {
        if (btn.disabled) mostrarAviso("Atenção", "Instala a aplicação primeiro!", "erro");
      });
    } else {
      btn.addEventListener("click", executarAtivacaoPush);
    }
  };
  protegerEAtivarBotao("btnAtivarNotificacoes");
  protegerEAtivarBotao("btnAceitarNotificacoesModal");

  document
    .getElementById("btnRecusarNotificacoes")
    ?.addEventListener("click", () =>
      document.getElementById("modalAvisoNotificacoes")?.classList.add("hidden"),
    );

  // ---- Pedido de aula particular ----
  const modalAula = document.getElementById("modalAulaParticular");
  const formAula = document.getElementById("formAulaParticular");
  const inputData = document.getElementById("dataParticular");
  const inputHora = document.getElementById("horaParticular");

  document.getElementById("btnAbrirModalParticular")?.addEventListener("click", () => {
    modalAula.classList.remove("hidden");
    inputData.setAttribute("min", dataLocalISO());
  });
  document.getElementById("btnFecharModalParticular")?.addEventListener("click", () => {
    modalAula.classList.add("hidden");
    formAula.reset();
  });

  formAula?.addEventListener("submit", async (e) => {
    e.preventDefault();
    // Validação rápida no browser (a validação que conta é feita no servidor).
    const [ano, mes, dia] = inputData.value.split("-").map(Number);
    const diaSemana = new Date(ano, mes - 1, dia).getDay();
    const horaSelecionada = parseInt(inputHora.value.split(":")[0], 10);
    if (diaSemana >= 1 && diaSemana <= 5) {
      mostrarAviso("Indisponível", MENSAGENS_ERRO.SO_FIM_DE_SEMANA, "erro");
      return;
    }
    if ((diaSemana === 0 && horaSelecionada < 10) || (diaSemana === 6 && horaSelecionada < 13)) {
      mostrarAviso("Fora de Horas", MENSAGENS_ERRO.FORA_DE_HORAS, "erro");
      return;
    }

    const btnSubmit = document.getElementById("btnPedirAula");
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = "A enviar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnSubmit.disabled = true;

    try {
      const pedido = await rpcPortal("portal_pedir_aula", {
        p_data: inputData.value,
        p_hora: inputHora.value,
        p_hoje: dataLocalISO(),
      });
      const nomeAtleta = pedido?.nome || atletaLogadoObj?.nome || "Atleta Bogas Team";
      const dataFormatada = inputData.value.split("-").reverse().join("/");

      // Avisos ao treinador: se falharem, o pedido já está guardado na mesma.
      supabase.functions
        .invoke("notificar-alvo", {
          body: {
            email_admin: EMAIL_ADMIN,
            titulo: "Nova Marcação de Aula Privada!",
            mensagem: `O atleta ${nomeAtleta} marcou uma aula particular para o dia ${dataFormatada}.`,
          },
        })
        .catch((err) => console.warn("Push ao treinador:", err));
      fetch(WEBHOOK_MAKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          atleta: nomeAtleta,
          dataAula: dataFormatada,
          horaAula: inputHora.value || "--:--",
          emailMestre: EMAIL_ADMIN,
          assunto: `Aula Particular: ${nomeAtleta}`,
        }),
      }).catch((err) => console.warn("Email ao treinador:", err));

      mostrarAviso("Pedido Enviado", "Aguardar confirmação!", "sucesso");
      modalAula.classList.add("hidden");
      formAula.reset();
      atualizarAulaENotificacoes().catch(() => {});
    } catch (erro) {
      const codigo = codigoErro(erro);
      mostrarAviso("Erro", codigo ? MENSAGENS_ERRO[codigo] : "Não foi possível enviar o pedido.", "erro");
    } finally {
      btnSubmit.innerHTML = textoOriginal;
      btnSubmit.disabled = false;
    }
  });
});
