/* JS/socios.js - GESTÃO DE SÓCIOS (Com Quadro de Inativos) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto, gerarMensagemWhatsApp } from "./helpers.js";
import { mostrarAviso } from "./main.js";

export async function carregarGuerreiros() {
  const tabelaSocios = document.getElementById("tabelaSocios");
  const filtroMes = document.getElementById("filtroMesMensalidade");
  if (tabelaSocios)
    tabelaSocios.innerHTML =
      '<tr><td colspan="5">A carregar e a calcular...</td></tr>';

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
    // 🥊 GUARDAR TODOS PARA PODERMOS EDITAR OS INATIVOS TAMBÉM
    state.todosOsGuerreiros = todosSocios;

    // 🥊 FILTRAR OS INATIVOS PARA A NOVA TABELA
    state.inativosAtuais = todosSocios.filter((s) => s.estado === "Inativo");

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
      return (a.nome || "").localeCompare(b.nome || "");
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

    renderizarTabelaSocios(socios, state.idsPagosGlobal, mesAtual);

    // 🥊 RENDERIZA TAMBÉM A TABELA DE INATIVOS EM BACKGROUND
    renderizarTabelaInativos(state.inativosAtuais);
  }
}

export function renderizarTabelaSocios(lista, idsPagos = null, mesAtual = "") {
  const tabelaSocios = document.getElementById("tabelaSocios");
  if (!tabelaSocios) return;
  tabelaSocios.innerHTML = "";

  if (!idsPagos) idsPagos = state.idsPagosGlobal || [];
  if (!mesAtual)
    mesAtual = document.getElementById("filtroMesMensalidade")?.value || "";

  if (lista.length === 0) {
    tabelaSocios.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #888;">Nenhum guerreiro registado neste mês.</td></tr>';
    return;
  }

  // OTIMIZAÇÃO: Criação de um fragmento de documento
  const fragment = document.createDocumentFragment();

  lista.forEach((s) => {
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

    // 🥊 CORREÇÃO: Adicionados os atributos data-label para UI Mobile
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

    // Adiciona ao fragmento (na memória) em vez do DOM real
    fragment.appendChild(tr);
  });

  // Injeta tudo de uma vez no DOM real
  tabelaSocios.appendChild(fragment);
}

// 🥊 NOVA FUNÇÃO: RENDERIZAR TABELA DE INATIVOS
export function renderizarTabelaInativos(lista) {
  const tabela = document.getElementById("tabelaInativos");
  if (!tabela) return;
  tabela.innerHTML = "";

  if (!lista || lista.length === 0) {
    tabela.innerHTML =
      '<tr><td colspan="5" style="text-align: center; color: #888;">Não existem sócios inativos registados.</td></tr>';
    return;
  }

  // 🥊 CORREÇÃO: Fragmento adicionado para evitar reflows múltiplos
  const fragment = document.createDocumentFragment();

  lista.forEach((s) => {
    const tr = document.createElement("tr");
    const dataSaida = s.data_inativo
      ? s.data_inativo.split("-").reverse().join("/")
      : "N/D";

    // 🥊 CORREÇÃO: Adicionados os atributos data-label para UI Mobile
    tr.innerHTML = `
      <td data-label="Nome" style="font-weight: 600;">${formatarNomeCurto(s.nome)}</td>
      <td data-label="Modalidade">${s.modalidade}</td>
      <td data-label="Estado"><span class="badge badge-inativo">${s.estado}</span></td>
      <td data-label="Data de Saída" style="color: #ff4d4d; font-weight: 600;">${dataSaida}</td>
      <td data-label="Ações">
          <button class="btn-acao btn-edit" data-id="${s.id}" title="Editar"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete" data-id="${s.id}" title="Eliminar"><i class='bx bx-trash'></i></button>
      </td>`;

    // Anexa ao fragmento
    fragment.appendChild(tr);
  });

  // Injeta de uma só vez
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
            "Erro a carregar a foto! Bucket 'fotos_socios' não existe ou não tem permissões.",
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
      // 🥊 CORREÇÃO: Await adicionado para garantir que a tabela só atualiza quando a DB confirmar
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

  // 🥊 NOVO: DELEGAÇÃO DE EVENTOS CENTRALIZADA PARA AS DUAS TABELAS (ATIVOS E INATIVOS)
  const handleAcoesTabela = async (e) => {
    const btnEdit = e.target.closest(".btn-edit");
    if (btnEdit) {
      // 🥊 Usa o todosOsGuerreiros para encontrar o sócio, mesmo que seja inativo
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
      // 🥊 1. OTIMIZAÇÃO: PROCURAR O SÓCIO NA MEMÓRIA (Sem query à BD)
      const socio = state.todosOsGuerreiros?.find(
        (s) => s.id == socioIdParaEliminar,
      );

      // 🥊 2. LIMPEZA: APAGAR A FOTOGRAFIA FÍSICA NO STORAGE (Se existir)
      if (socio && socio.foto_url) {
        // Extrai apenas o nome do ficheiro no fim do URL
        const fileName = socio.foto_url.split("/").pop();

        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from("fotos_socios")
            .remove([fileName]);

          if (storageError) {
            console.warn(
              "Aviso: A foto não pôde ser apagada do Storage:",
              storageError,
            );
            // Nota: Não usamos 'throw' aqui para garantir que se o ficheiro já não
            // existir (ou der erro de cache), o Sócio será apagado da BD na mesma.
          } else {
            console.log("Ficheiro de imagem limpo do Storage.");
          }
        }
      }

      // 🥊 3. TIRO FINAL: APAGAR NA BASE DE DADOS (Dispara ON DELETE CASCADE)
      const { data, error } = await supabase
        .from("socios")
        .delete()
        .eq("id", socioIdParaEliminar)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error(
          "A base de dados bloqueou a eliminação. Verifica permissões (RLS)!",
        );
      }

      modalDeleteSocio.classList.add("hidden");

      // Sincroniza as tabelas com os dados mais recentes
      await carregarGuerreiros();
      mostrarAviso(
        "Atleta Eliminado",
        "Registo e fotografia apagados com sucesso.",
        "sucesso",
      );
    } catch (erro) {
      mostrarAviso("Erro ao eliminar", erro.message, "erro");
    } finally {
      btnConfirmarDelete.innerHTML = textoOriginal;
      btnConfirmarDelete.disabled = false;
      socioIdParaEliminar = null;
    }
  });
}
