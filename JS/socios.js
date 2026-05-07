/* JS/socios.js - GESTÃO DE SÓCIOS (Com Quadro de Inativos e Paginação) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto, gerarMensagemWhatsApp } from "./helpers.js";
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

  const { data: mensalidadesMes } = await supabase
    .from("mensalidades")
    .select("socio_id, estado")
    .eq("mes_ano", mesAtual);

  if (todosSocios) {
    state.todosOsGuerreiros = todosSocios;

    state.inativosAtuais = todosSocios
      .filter((s) => s.estado === "Inativo")
      .sort((a, b) =>
        (a.nome || "")
          .trim()
          .localeCompare((b.nome || "").trim(), "pt", { sensitivity: "base" }),
      );

    const idsFaturados = mensalidadesMes
      ? mensalidadesMes.map((m) => m.socio_id)
      : [];

    state.idsPagosGlobal = mensalidadesMes
      ? mensalidadesMes
          .filter((m) => m.estado === "Pago")
          .map((m) => m.socio_id)
      : [];

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
        !idsFaturados.includes(s.id)
      )
        return false;
      if (s.modalidade === "Aulas Particulares")
        return idsFaturados.includes(s.id);

      return s.estado === "Ativo" || idsFaturados.includes(s.id);
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

    const pendentesAtivos = socios.filter(
      (s) => !state.idsPagosGlobal.includes(s.id),
    );

    if (document.getElementById("totalSocios"))
      document.getElementById("totalSocios").innerText = socios.length;
    if (document.getElementById("pagamentosPendentes"))
      document.getElementById("pagamentosPendentes").innerText =
        pendentesAtivos.length;

    // Reset da paginação sempre que carregamos dados novos
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

  // Se for uma pesquisa ou carregamento inicial, volta à primeira página
  if (!manterPagina) paginaAtualAtivos = 1;

  if (!idsPagos) idsPagos = state.idsPagosGlobal || [];
  if (!mesAtual)
    mesAtual = document.getElementById("filtroMesMensalidade")?.value || "";

  tabelaSocios.innerHTML = "";

  if (lista.length === 0) {
    tabelaSocios.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum guerreiro registado neste mês.</td></tr>';
    return;
  }

  // 🥊 A MAGIA DA PAGINAÇÃO: Corta a lista para mostrar só os necessários
  const limiteAtual = paginaAtualAtivos * ITENS_POR_PAGINA;
  const listaPaginada = lista.slice(0, limiteAtual);

  const fragment = document.createDocumentFragment();

  listaPaginada.forEach((s) => {
    const tr = document.createElement("tr");
    const estaPago = idsPagos.includes(s.id);
    const isInativo = s.estado === "Inativo";

    const badgeMensalidade = estaPago
      ? "badge-pago"
      : isInativo
        ? "badge-inativo"
        : "badge-pendente";
    const textoMensalidade = estaPago ? "Pago" : isInativo ? "N/A" : "Pendente";
    const btnFaturar =
      !estaPago && !isInativo
        ? `<button class="btn-acao btn-faturar" data-id="${s.id}" title="Faturar"><i class='bx bx-euro'></i></button>`
        : "";
    const btnWhatsApp =
      !estaPago && !isInativo && s.telemovel
        ? `<a href="https://wa.me/351${s.telemovel}?text=${gerarMensagemWhatsApp(s.nome, mesAtual)}" target="_blank" class="btn-acao btn-whatsapp" title="Avisar"><i class='bx bxl-whatsapp'></i></a>`
        : "";

    tr.innerHTML = `
      <td data-label="Nome" style="font-weight: 600;">${formatarNomeCurto(s.nome)}</td>
      <td data-label="Modalidade">${s.modalidade}</td>
      <td data-label="Estado"><span class="badge ${isInativo ? "badge-inativo" : "badge-ativo"}">${s.estado}</span></td>
      <td data-label="Mensalidade"><span class="badge ${badgeMensalidade}">${textoMensalidade}</span></td>
      <td data-label="Ações">
          <button class="btn-acao btn-edit" data-id="${s.id}" title="Editar"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete" data-id="${s.id}" title="Eliminar"><i class='bx bx-trash'></i></button>
          ${btnFaturar}
          ${btnWhatsApp}
      </td>`;

    fragment.appendChild(tr);
  });

  // 🥊 SE AINDA HOUVER MAIS ATLETAS PARA MOSTRAR, CRIA O BOTÃO "CARREGAR MAIS"
  if (limiteAtual < lista.length) {
    const trMore = document.createElement("tr");
    trMore.innerHTML = `
      <td colspan="5" style="text-align: center; padding: 15px;">
        <button class="btn-tatico btn-small btn-carregar-mais" style="width: 100%; border-color: var(--accent); color: var(--accent);">
          Carregar mais <i class='bx bx-chevron-down bx-fade-down'></i>
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
          <button class="btn-acao btn-edit" data-id="${s.id}" title="Editar"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete" data-id="${s.id}" title="Eliminar"><i class='bx bx-trash'></i></button>
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
      // Re-desenha a tabela mantendo a nova página (true) e os filtros atuais
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
