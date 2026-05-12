/* JS/socios.js - GESTÃO DE SÓCIOS (Com Quadro de Inativos e Paginação) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto } from "./helpers.js";
import { mostrarAviso } from "./main.js";

// 🥊 VARIÁVEIS DE CONTROLO DE PAGINAÇÃO
let paginaAtualAtivos = 1;
const ITENS_POR_PAGINA = 10;

export async function carregarGuerreiros() {
  const tabelaSocios = document.getElementById("tabelaSocios");
  const filtroMes = document.getElementById("filtroMesMensalidade");

  if (tabelaSocios) {
    tabelaSocios.innerHTML =
      '<tr><td colspan="5">A carregar e a calcular...</td></tr>';
  }

  const { data: todosSocios } = await supabase
    .from("socios")
    .select("*")
    .eq("treinador", state.treinadorAtual);

  const mesAtual = filtroMes
    ? filtroMes.value
    : new Date().toISOString().slice(0, 7);

  // 🥊 PUXA TAMBÉM O TIPO (MENSALIDADE VS AULA)
  const { data: mensalidadesMes } = await supabase
    .from("mensalidades")
    .select("socio_id, estado, tipo")
    .eq("mes_ano", mesAtual);

  if (todosSocios) {
    state.todosOsGuerreiros = todosSocios;
    state.faturasMesAtual = mensalidadesMes || []; // Guarda no state para a tabela ler

    state.inativosAtuais = todosSocios
      .filter((s) => s.estado === "Inativo")
      .sort((a, b) =>
        (a.nome || "")
          .trim()
          .localeCompare((b.nome || "").trim(), "pt", { sensitivity: "base" }),
      );

    const faturasMensais = state.faturasMesAtual.filter(
      (m) => !m.tipo || m.tipo === "Mensalidade",
    );
    const todosIdsFaturados = state.faturasMesAtual.map((m) => m.socio_id);

    // Identifica quem já pagou apenas a Mensalidade (exclui as PTs)
    state.idsPagosGlobal = faturasMensais
      .filter((m) => m.estado === "Pago")
      .map((m) => m.socio_id);

    const socios = todosSocios.filter((s) => {
      const mesInscricao = s.data_inscricao
        ? s.data_inscricao.substring(0, 7)
        : "0000-00";
      const mesSaida = s.data_inativo
        ? s.data_inativo.substring(0, 7)
        : "9999-12";
      const mesReentrada = s.data_reentrada
        ? s.data_reentrada.substring(0, 7)
        : "9999-12";

      if (mesAtual < mesInscricao) return false;
      if (
        mesAtual > mesSaida &&
        mesAtual < mesReentrada &&
        !todosIdsFaturados.includes(s.id)
      )
        return false;

      if (s.modalidade === "Aulas Particulares")
        return todosIdsFaturados.includes(s.id);

      return s.estado === "Ativo" || todosIdsFaturados.includes(s.id);
    });

    socios.sort((a, b) => {
      const pagoA = state.idsPagosGlobal.includes(a.id);
      const pagoB = state.idsPagosGlobal.includes(b.id);
      if (pagoA !== pagoB) return pagoA ? 1 : -1;

      const partesA = (a.nome || "").trim().toLowerCase().split(" ");
      const partesB = (b.nome || "").trim().toLowerCase().split(" ");

      const primeiroA = partesA[0];
      const ultimoA = partesA[partesA.length - 1];
      const primeiroB = partesB[0];
      const ultimoB = partesB[partesB.length - 1];

      if (primeiroA < primeiroB) return -1;
      if (primeiroA > primeiroB) return 1;
      if (ultimoA < ultimoB) return -1;
      if (ultimoA > ultimoB) return 1;

      return 0;
    });

    state.guerreirosAtuais = socios;

    // 🥊 LÓGICA DE CÁLCULO DE PENDENTES (MENSALIDADES + AULAS)
    const idsComDividaAtiva = state.faturasMesAtual
      ? state.faturasMesAtual
          .filter((m) => m.estado === "Pendente")
          .map((m) => m.socio_id)
      : [];

    const pendentesReais = socios.filter((s) => {
      const temFaturaPendente = idsComDividaAtiva.includes(s.id);
      const naoTemMensalidade =
        !state.idsPagosGlobal.includes(s.id) &&
        s.modalidade !== "Aulas Particulares";

      return temFaturaPendente || naoTemMensalidade;
    });

    if (document.getElementById("totalSocios"))
      document.getElementById("totalSocios").innerText = socios.length;

    if (document.getElementById("pagamentosPendentes"))
      document.getElementById("pagamentosPendentes").innerText =
        pendentesReais.length;

    paginaAtualAtivos = 1;
    renderizarTabelaSocios(socios, state.idsPagosGlobal, mesAtual);
    renderizarTabelaInativos(state.inativosAtuais);
  }
}

export function renderizarTabelaSocios(
  lista,
  idsPagos = null,
  mesAtual = "",
  manterPagina = false,
) {
  const tabelaSocios = document.getElementById("tabelaSocios");
  if (!tabelaSocios) return;

  if (!manterPagina) paginaAtualAtivos = 1;

  if (!mesAtual)
    mesAtual = document.getElementById("filtroMesMensalidade")?.value || "";

  tabelaSocios.innerHTML = "";

  if (lista.length === 0) {
    tabelaSocios.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum guerreiro registado neste mês.</td></tr>';
    return;
  }

  const limiteAtual = paginaAtualAtivos * ITENS_POR_PAGINA;
  const listaPaginada = lista.slice(0, limiteAtual);

  const fragment = document.createDocumentFragment();

  listaPaginada.forEach((s) => {
    const tr = document.createElement("tr");
    const isInativo = s.estado === "Inativo";

    const faturasDoSocio = (state.faturasMesAtual || []).filter(
      (m) => m.socio_id === s.id,
    );
    const faturaMensalidade = faturasDoSocio.find(
      (m) => !m.tipo || m.tipo === "Mensalidade",
    );
    const aulasPendentes = faturasDoSocio.filter(
      (m) => m.tipo === "Aula Particular" && m.estado === "Pendente",
    );

    let badgeMensalidade = "";
    let textoMensalidade = "";
    let mostrarEuro = false;
    let modalidadeExibida = s.modalidade;
    let isPendentePT = false; // 🥊 Flag invisível para o WhatsApp saber o que cobrar

    if (isInativo) {
      badgeMensalidade = "badge-inativo";
      textoMensalidade = "N/A";
    } else {
      const isPTOnly = s.modalidade === "Aulas Particulares";

      if (isPTOnly) {
        if (aulasPendentes.length > 0) {
          badgeMensalidade = "badge-pendente";
          textoMensalidade = "PENDENTE"; // 🥊 Alterado para ficar limpo
          isPendentePT = true;
        } else {
          badgeMensalidade = "badge-pago";
          textoMensalidade = "PAGO";
        }
      } else {
        const mensalidadePaga =
          faturaMensalidade && faturaMensalidade.estado === "Pago";

        if (!mensalidadePaga) {
          badgeMensalidade = "badge-pendente";
          textoMensalidade = "PENDENTE";
          mostrarEuro = true;
        } else if (aulasPendentes.length > 0) {
          badgeMensalidade = "badge-pendente";
          textoMensalidade = "PENDENTE"; // 🥊 Alterado para ficar limpo
          modalidadeExibida = "Aula Particular";
          mostrarEuro = false;
          isPendentePT = true;
        } else {
          badgeMensalidade = "badge-pago";
          textoMensalidade = "PAGO";
        }
      }
    }

    const btnFaturar = mostrarEuro
      ? `<button class="btn-acao btn-faturar" data-id="${s.id}" title="Faturar"><i class='bx bx-euro'></i></button>`
      : "";

    // =======================================================================
    // 🥊 MENSAGEM DE WHATSAPP DINÂMICA (MENSALIDADE VS AULA PARTICULAR)
    // =======================================================================
    let msgWhatsApp = "";
    const nomeCortado = formatarNomeCurto(s.nome);

    if (isPendentePT) {
      // 🥊 Agora usa a flag invisível em vez do texto visual
      // Procura a aula pendente no estado global para saber a data e hora exatas
      const ptPendente = (state.aulasParticulares || []).find(
        (a) => a.socio_id === s.id && a.estado === "Aceite" && !a.pago,
      );

      if (ptPendente) {
        const dataF = ptPendente.data_aula.split("-").reverse().join("/");
        const horaF = ptPendente.hora_aula.substring(0, 5);
        msgWhatsApp = `Caro(a) ${nomeCortado}. Verificamos nos nossos registos que a Aula Particular do dia ${dataF} às ${horaF} se encontra pendente. Solicitamos, por favor, a regularização da mesma com a maior brevidade possível.`;
      } else {
        // Fallback caso a aula específica não esteja ainda carregada na memória
        msgWhatsApp = `Caro(a) ${nomeCortado}. Verificamos nos nossos registos que uma Aula Particular se encontra pendente. Solicitamos, por favor, a regularização da mesma com a maior brevidade possível.`;
      }
    } else {
      // Mensagem para a mensalidade normal
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
      const [ano, mes] = mesAtual.split("-");
      const nomeMes = mesesPT[parseInt(mes) - 1];
      msgWhatsApp = `Caro(a) ${nomeCortado}. Verificamos nos nossos registos que a mensalidade de ${nomeMes} de ${ano} se encontra atualmente pendente. Solicitamos, por favor, a regularização da mesma com a maior brevidade possível.`;
    }

    const btnWhatsApp =
      textoMensalidade === "PENDENTE" && s.telemovel // 🥊 Simplificado
        ? `<a href="https://wa.me/351${s.telemovel}?text=${encodeURIComponent(msgWhatsApp)}" target="_blank" class="btn-acao btn-whatsapp" title="Avisar"><i class='bx bxl-whatsapp'></i></a>`
        : "";

    tr.innerHTML = `
      <td data-label="Nome" style="font-weight: 600;">${nomeCortado}</td>
      <td data-label="Modalidade">${modalidadeExibida}</td>
      <td data-label="Estado"><span class="badge ${isInativo ? "badge-inativo" : "badge-ativo"}">${s.estado}</span></td>
      <td data-label="Mensalidade"><span class="badge ${badgeMensalidade}">${textoMensalidade}</span></td>
      <td data-label="Ações">
        <div style="display:flex; gap: 6px; align-items:center; justify-content: center;">
          <button class="btn-acao btn-edit" data-id="${s.id}" title="Editar"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete" data-id="${s.id}" title="Eliminar"><i class='bx bx-trash'></i></button>
          ${btnFaturar}
          ${btnWhatsApp}
        </div>
      </td>`;

    fragment.appendChild(tr);
  });

  if (limiteAtual < lista.length) {
    const trMore = document.createElement("tr");
    trMore.innerHTML = `
      <td colspan="5" style="text-align: center; padding: 15px;">
        <button class="btn-tatico btn-small btn-carregar-mais">
          CARREGAR MAIS <i class='bx bx-chevron-down bx-fade-down'></i>
        </button>
      </td>`;
    fragment.appendChild(trMore);
  }

  tabelaSocios.appendChild(fragment);
}

export function renderizarTabelaInativos(lista) {
  const tabela = document.getElementById("tabelaInativos");
  if (!tabela) return;
  tabela.innerHTML = "";

  if (!lista || lista.length === 0) {
    tabela.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #888;">Não existem sócios inativos registados.</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();

  lista.forEach((s) => {
    const tr = document.createElement("tr");
    const dataSaida = s.data_inativo
      ? s.data_inativo.split("-").reverse().join("/")
      : "N/D";

    tr.innerHTML = `
      <td data-label="Nome" style="font-weight: 600;">${formatarNomeCurto(s.nome)}</td>
      <td data-label="Modalidade">${s.modalidade}</td>
      <td data-label="Estado"><span class="badge badge-inativo">${s.estado}</span></td>
      <td data-label="Data de Saída" style="color: #ff4d4d; font-weight: 600;">${dataSaida}</td>
      <td data-label="Ações">
        <div style="display:flex; gap: 6px; align-items:center; justify-content: center;">
          <button class="btn-acao btn-edit" data-id="${s.id}" title="Editar"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete" data-id="${s.id}" title="Eliminar"><i class='bx bx-trash'></i></button>
        </div>
      </td>`;

    fragment.appendChild(tr);
  });

  tabela.appendChild(fragment);
}

export function initSociosEvents() {
  const modalSocio = document.getElementById("modalSocio");
  const formSocio = document.getElementById("formNovoSocio");
  const tituloModal = document.querySelector("#modalSocio .modal-header h3");
  const btnGuardar = document.getElementById("btnGuardarSocio");

  const modalDeleteSocio = document.getElementById("modalConfirmDeleteSocio");
  const btnCancelarDelete = document.getElementById("btnCancelarDeleteSocio");
  const btnConfirmarDelete = document.getElementById("btnConfirmarDeleteSocio");
  let socioIdParaEliminar = null;

  document.getElementById("btnAddSocio")?.addEventListener("click", () => {
    state.idSocioEmEdicao = null;
    formSocio.reset();
    tituloModal.innerHTML =
      "<i class='bx bx-user-plus'></i> Registar Novo Sócio";
    btnGuardar.innerHTML = "Guardar Atleta <i class='bx bx-save'></i>";
    document.getElementById("dataInscricao").valueAsDate = new Date();

    if (document.getElementById("dataSaidaSocio"))
      document.getElementById("dataSaidaSocio").value = "";
    if (document.getElementById("dataReentradaSocio"))
      document.getElementById("dataReentradaSocio").value = "";
    if (document.getElementById("dataUltimaGraduacao"))
      document.getElementById("dataUltimaGraduacao").value = "";
    if (document.getElementById("fotoSocio"))
      document.getElementById("fotoSocio").value = "";

    modalSocio.classList.remove("hidden");
  });

  formSocio?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML =
      "A processar... <i class='bx bx-loader-alt bx-spin'></i>";

    try {
      const estadoAtual = document.getElementById("estadoSocio").value;
      const dataSaidaInput = document.getElementById("dataSaidaSocio")?.value;
      const dataReentradaInput =
        document.getElementById("dataReentradaSocio")?.value;
      const dataUltimaGradInput = document.getElementById(
        "dataUltimaGraduacao",
      )?.value;

      const dados = {
        nome: document.getElementById("nomeSocio").value,
        email: document.getElementById("emailSocio")?.value || null,
        telemovel: document.getElementById("telSocio").value,
        modalidade: document.getElementById("modSocio").value,
        treinador: document.getElementById("treinadorSocio").value,
        data_inscricao: document.getElementById("dataInscricao").value,
        estado: estadoAtual,
        graduacao: document.getElementById("graduacaoSocio").value,
        federacao: document.getElementById("federacaoSocio").value,
        data_ultima_graduacao: dataUltimaGradInput || null,
        data_inativo: dataSaidaInput || null,
        data_reentrada: dataReentradaInput || null,
      };

      const fotoInput = document.getElementById("fotoSocio");
      if (fotoInput && fotoInput.files && fotoInput.files.length > 0) {
        btnGuardar.innerHTML =
          "A enviar foto... <i class='bx bx-loader-alt bx-spin'></i>";
        const file = fotoInput.files[0];
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("fotos_socios")
          .upload(fileName, file);
        if (uploadError)
          throw new Error(
            "Erro a carregar a foto! Verifique permissões do bucket.",
          );

        const { data: urlData } = supabase.storage
          .from("fotos_socios")
          .getPublicUrl(fileName);
        dados.foto_url = urlData.publicUrl;
      }

      if (state.idSocioEmEdicao) {
        const { error } = await supabase
          .from("socios")
          .update(dados)
          .eq("id", state.idSocioEmEdicao);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("socios").insert([dados]);
        if (error) throw error;
      }

      modalSocio.classList.add("hidden");
      await carregarGuerreiros();
      mostrarAviso(
        "Sócio Atualizado",
        "Os dados foram guardados com sucesso.",
        "sucesso",
      );
    } catch (err) {
      mostrarAviso("Erro na Base de Dados", err.message, "erro");
    } finally {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = textoOriginal;
    }
  });

  const handleAcoesTabela = async (e) => {
    // 🥊 VIGIA DO BOTÃO CARREGAR MAIS (Paginação)
    const btnCarregarMais = e.target.closest(".btn-carregar-mais");
    if (btnCarregarMais) {
      paginaAtualAtivos++;
      const filtroAtivo = document
        .getElementById("filtroNomeSocio")
        ?.value.toLowerCase();
      let listaAUsar = state.guerreirosAtuais;

      if (filtroAtivo) {
        listaAUsar = state.guerreirosAtuais.filter((s) =>
          s.nome.toLowerCase().includes(filtroAtivo),
        );
      }

      renderizarTabelaSocios(listaAUsar, state.idsPagosGlobal, null, true);
      return;
    }

    // 🥊 O ATALHO RESTAURADO: BOTÃO FATURAR
    const btnFaturar = e.target.closest(".btn-faturar");
    if (btnFaturar) {
      const socio = state.todosOsGuerreiros?.find(
        (s) => s.id == btnFaturar.dataset.id,
      );
      if (socio) {
        state.idMensalidadeEmEdicao = null;
        document.getElementById("formNovoPagamento")?.reset();

        document.getElementById("pagamentoSocioSearch").value = socio.nome;
        document.getElementById("pagamentoSocioId").value = socio.id;
        document.getElementById("pagamentoMes").value = document.getElementById(
          "filtroMesMensalidade",
        ).value;

        document.querySelector("#modalPagamento .modal-header h3").innerHTML =
          "<i class='bx bx-euro'></i> Registar Pagamento";
        document.getElementById("modalPagamento").classList.remove("hidden");
      }
      return;
    }

    const btnEdit = e.target.closest(".btn-edit");
    if (btnEdit) {
      const socio = state.todosOsGuerreiros?.find(
        (s) => s.id == btnEdit.dataset.id,
      );
      if (socio) {
        state.idSocioEmEdicao = socio.id;
        document.getElementById("nomeSocio").value = socio.nome || "";
        if (document.getElementById("emailSocio"))
          document.getElementById("emailSocio").value = socio.email || "";
        document.getElementById("telSocio").value = socio.telemovel || "";
        document.getElementById("modSocio").value = socio.modalidade || "";
        document.getElementById("treinadorSocio").value = socio.treinador || "";
        document.getElementById("dataInscricao").value =
          socio.data_inscricao || "";
        document.getElementById("estadoSocio").value = socio.estado || "Ativo";
        document.getElementById("graduacaoSocio").value =
          socio.graduacao || "N/A";
        document.getElementById("federacaoSocio").value =
          socio.federacao || "Não Regularizada";

        if (document.getElementById("dataSaidaSocio"))
          document.getElementById("dataSaidaSocio").value =
            socio.data_inativo || "";
        if (document.getElementById("dataReentradaSocio"))
          document.getElementById("dataReentradaSocio").value =
            socio.data_reentrada || "";
        if (document.getElementById("dataUltimaGraduacao"))
          document.getElementById("dataUltimaGraduacao").value =
            socio.data_ultima_graduacao || "";
        if (document.getElementById("fotoSocio"))
          document.getElementById("fotoSocio").value = "";

        tituloModal.innerHTML = "<i class='bx bx-edit'></i> Editar Sócio";
        btnGuardar.innerHTML = "Atualizar Atleta <i class='bx bx-refresh'></i>";
        modalSocio.classList.remove("hidden");
      }
      return;
    }

    const btnDelete = e.target.closest(".btn-delete");
    if (btnDelete) {
      socioIdParaEliminar = btnDelete.getAttribute("data-id");
      modalDeleteSocio?.classList.remove("hidden");
    }
  };

  document
    .getElementById("tabelaSocios")
    ?.addEventListener("click", handleAcoesTabela);
  document
    .getElementById("tabelaInativos")
    ?.addEventListener("click", handleAcoesTabela);

  btnCancelarDelete?.addEventListener("click", () => {
    modalDeleteSocio.classList.add("hidden");
    socioIdParaEliminar = null;
  });

  btnConfirmarDelete?.addEventListener("click", async () => {
    if (!socioIdParaEliminar) return;

    const textoOriginal = btnConfirmarDelete.innerHTML;
    btnConfirmarDelete.innerHTML =
      "A apagar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirmarDelete.disabled = true;

    try {
      const socio = state.todosOsGuerreiros?.find(
        (s) => s.id == socioIdParaEliminar,
      );

      if (socio && socio.foto_url) {
        const fileName = socio.foto_url.split("/").pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from("fotos_socios")
            .remove([fileName]);
          if (storageError)
            console.warn(
              "Aviso: A foto não pôde ser apagada do Storage:",
              storageError,
            );
        }
      }

      const { data, error } = await supabase
        .from("socios")
        .delete()
        .eq("id", socioIdParaEliminar)
        .select();
      if (error) throw error;
      if (!data || data.length === 0)
        throw new Error("A BD bloqueou a eliminação. Verifica RLS!");

      modalDeleteSocio.classList.add("hidden");
      await carregarGuerreiros();
      mostrarAviso("Atleta Eliminado", "Registo e foto apagados.", "sucesso");
    } catch (erro) {
      mostrarAviso("Erro ao eliminar", erro.message, "erro");
    } finally {
      btnConfirmarDelete.innerHTML = textoOriginal;
      btnConfirmarDelete.disabled = false;
      socioIdParaEliminar = null;
    }
  });
}
