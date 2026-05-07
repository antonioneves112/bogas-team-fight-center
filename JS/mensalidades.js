/* JS/mensalidades.js - GESTÃO DE MENSALIDADES (Modais Premium) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto, extrairPreco, debounce } from "./helpers.js"; // 🥊 IMPORT: Agrupado e adicionado o debounce
import { carregarGuerreiros } from "./socios.js";
import { mostrarAviso } from "./main.js"; // 🥊 IMPORTAMOS OS AVISOS VISUAIS

export function renderizarTabelaMensalidades(lista) {
  const tabelaMensalidades = document.getElementById("tabelaMensalidades");
  const filtroMes = document.getElementById("filtroMesMensalidade");
  tabelaMensalidades.innerHTML = "";

  let totalGeral = 0;

  // Filtro de Segurança
  const listaAtivos = lista.filter((m) => m.socios?.estado !== "Inativo");

  if (listaAtivos.length === 0) {
    tabelaMensalidades.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">Nenhum registo de atletas ativos.</td></tr>';
    return;
  }

  const mesReferencia = filtroMes.value;

  // 🥊 OTIMIZAÇÃO: Criação do fragmento para evitar reflows múltiplos
  const fragment = document.createDocumentFragment();

  listaAtivos.forEach((m) => {
    totalGeral += extrairPreco(m.valor);

    const isPago = m.estado === "Pago";
    const badgeClass = isPago ? "badge-pago" : "badge-pendente";
    const isNovoNoMes =
      m.socios?.data_inscricao &&
      m.socios.data_inscricao.startsWith(mesReferencia);
    const classeNeon = isNovoNoMes ? "neon-destaque" : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Mês / Ano" class="${classeNeon}">${m.mes_ano}</td>
      <td data-label="Sócio" class="${classeNeon}" style="font-weight: 600;">${formatarNomeCurto(m.socios?.nome)}</td>
      <td data-label="Tipo" class="${classeNeon}">${m.tipo || "Mensalidade"}</td>
      <td data-label="Modalidade" class="${classeNeon}">${m.socios?.modalidade || "N/A"}</td>
      <td data-label="Valor" class="${classeNeon}">${m.valor}€</td> <!-- O € é colocado AQUI VISUALMENTE! -->
      <td data-label="Estado"><span class="badge ${badgeClass}">${m.estado}</span></td>
      <td data-label="Ações">
          <button class="btn-acao btn-edit-mensalidade" data-id="${m.id}"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete-mensalidade" data-id="${m.id}"><i class='bx bx-trash'></i></button>
      </td>`;

    // 🥊 OTIMIZAÇÃO: Adiciona a row ao fragmento na memória
    fragment.appendChild(tr);
  });

  const trTotal = document.createElement("tr");
  trTotal.style.background = "rgba(37, 211, 102, 0.1)";
  trTotal.innerHTML = `
    <td colspan="4" style="text-align: right; font-weight: bold; color: var(--accent);">TOTAL FATURADO (ATIVOS):</td>
    <td style="font-weight: bold; color: var(--accent);">${totalGeral.toFixed(2)}€</td>
    <td colspan="2"></td>
  `;

  // 🥊 OTIMIZAÇÃO: Adiciona a row totalizadora ao fragmento
  fragment.appendChild(trTotal);

  // 🥊 OTIMIZAÇÃO: Injeta todo o conteúdo de uma só vez no DOM real
  tabelaMensalidades.appendChild(fragment);
}

export async function carregarMensalidades() {
  const tabelaMensalidades = document.getElementById("tabelaMensalidades");
  const filtroMes = document.getElementById("filtroMesMensalidade");
  tabelaMensalidades.innerHTML =
    '<tr><td colspan="7">A carregar registos...</td></tr>';
  const mesReferencia = filtroMes.value;

  const { data: mensalidades } = await supabase
    .from("mensalidades")
    .select(
      `id, mes_ano, valor, estado, tipo, socio_id, socios ( nome, modalidade, telemovel, data_inscricao, estado )`,
    )
    .eq("mes_ano", mesReferencia);

  if (mensalidades) {
    const apenasAtivos = mensalidades.filter(
      (m) => m.socios?.estado !== "Inativo",
    );

    apenasAtivos.sort((a, b) => {
      // 🥊 ORDENAÇÃO BLINDADA (Tradicional e à prova de bugs de browser)
      const nomeA = String(a.socios?.nome || "")
        .trim()
        .toLowerCase();
      const nomeB = String(b.socios?.nome || "")
        .trim()
        .toLowerCase();

      if (nomeA < nomeB) return -1; // A sobe
      if (nomeA > nomeB) return 1; // B sobe
      return 0; // Iguais
    });

    state.mensalidadesAtuais = apenasAtivos;
    renderizarTabelaMensalidades(apenasAtivos);

    const totalArrecadado = apenasAtivos
      .filter((m) => m.estado === "Pago")
      .reduce((soma, m) => soma + (parseFloat(m.valor) || 0), 0);

    const elReceita = document.getElementById("totalMensalidade");
    if (elReceita) elReceita.innerText = totalArrecadado + " €";
  }
}

export async function prepararSelectSocios() {
  const { data: todos } = await supabase
    .from("socios")
    .select("id, nome, estado")
    .eq("treinador", state.treinadorAtual)
    .order("nome");

  const dataList = document.getElementById("listaSocios");
  if (!dataList) return;
  dataList.innerHTML = "";

  if (todos) {
    todos.forEach((s) => {
      const sufixo = s.estado === "Inativo" ? " (Inativo)" : "";
      const option = document.createElement("option");
      option.value = `${s.nome}${sufixo}`;
      option.setAttribute("data-id", s.id);
      dataList.appendChild(option);
    });
  }
}

export function initMensalidadesEvents() {
  const modalPagamento = document.getElementById("modalPagamento");
  const formNovoPagamento = document.getElementById("formNovoPagamento");
  const tituloModalPagamento = document.querySelector(
    "#modalPagamento .modal-header h3",
  );
  const filtroMes = document.getElementById("filtroMesMensalidade");

  // 🥊 ELEMENTOS DO NOVO MODAL DE ELIMINAÇÃO
  const modalDeleteMensalidade = document.getElementById(
    "modalConfirmDeleteMensalidade",
  );
  const btnCancelarDeleteMens = document.getElementById(
    "btnCancelarDeleteMensalidade",
  );
  const btnConfirmarDeleteMens = document.getElementById(
    "btnConfirmarDeleteMensalidade",
  );
  let mensalidadeIdParaEliminar = null;

  const inputSearch = document.getElementById("pagamentoSocioSearch");
  const inputId = document.getElementById("pagamentoSocioId");

  if (inputSearch && inputId) {
    inputSearch.addEventListener("input", (e) => {
      const val = e.target.value;
      const datalist = document.getElementById("listaSocios");
      if (!datalist) return;
      const options = Array.from(datalist.options);

      const selectedOption = options.find((opt) => opt.value === val);

      if (selectedOption) {
        inputId.value = selectedOption.getAttribute("data-id");
      } else {
        inputId.value = "";
      }
    });
  }

  document
    .getElementById("pagamentoMes")
    ?.addEventListener("change", prepararSelectSocios);

  document
    .getElementById("btnAddPagamento")
    ?.addEventListener("click", async () => {
      state.idMensalidadeEmEdicao = null;
      formNovoPagamento.reset();
      if (inputId) inputId.value = "";
      document.getElementById("pagamentoMes").value = filtroMes.value;
      tituloModalPagamento.innerHTML =
        "<i class='bx bx-euro'></i> Registar Pagamento";
      await prepararSelectSocios();
      modalPagamento.classList.remove("hidden");
    });

  formNovoPagamento?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!inputId.value) {
      mostrarAviso(
        "Atenção",
        "Tens de selecionar um Sócio válido da lista!",
        "erro",
      );
      return;
    }

    // 🥊 BLINDAGEM: Limpar o Preço antes de inserir via Modal Manual
    let valorDigitadoManual = document.getElementById("pagamentoValor").value;
    const valorLimpoManual = parseFloat(
      valorDigitadoManual.replace("€", "").replace(",", ".").trim(),
    );

    const dados = {
      socio_id: inputId.value,
      mes_ano: document.getElementById("pagamentoMes").value,
      valor: valorLimpoManual, // Usamos o limpo!
      estado: document.getElementById("pagamentoEstado").value,
      tipo: document.getElementById("pagamentoTipo").value,
    };

    try {
      if (state.idMensalidadeEmEdicao) {
        const { error } = await supabase
          .from("mensalidades")
          .update(dados)
          .eq("id", state.idMensalidadeEmEdicao);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("mensalidades").insert([dados]);
        if (error) throw error;
      }

      // 🥊 SE FOR MARCADO COMO PAGO (Avisa o Atleta e Levanta a Taça)
      if (dados.estado === "Pago") {
        await supabase
          .from("socios")
          .update({ estado: "Ativo" })
          .eq("id", dados.socio_id);

        try {
          const tituloNotif = "Mensalidade Validada";
          const mensagemNotif = `O teu pagamento referente a ${dados.mes_ano} foi validado com sucesso.`;

          const { error: notifError } = await supabase
            .from("notificacoes")
            .insert([
              {
                socio_id: dados.socio_id,
                titulo: tituloNotif,
                mensagem: mensagemNotif,
                lida: false,
              },
            ]);

          if (notifError) throw notifError;

          try {
            await supabase.functions.invoke("notificar-alvo", {
              body: {
                socio_id: parseInt(dados.socio_id),
                titulo: tituloNotif,
                mensagem: mensagemNotif,
              },
            });
          } catch (erroPush) {
            console.warn("Aviso: Falha na chamada do Push.", erroPush);
          }
        } catch (err) {
          console.error("Falha ao guardar notificação de pagamento:", err);
        }

        // 🥊 AVISO VISUAL DE VITÓRIA (PAGO)
        mostrarAviso(
          "Faturado!",
          "Mensalidade paga com sucesso e notificação entregue ao atleta.",
          "sucesso",
        );
      }

      modalPagamento.classList.add("hidden");
      carregarGuerreiros();
      carregarMensalidades();
    } catch (err) {
      mostrarAviso("Erro", err.message, "erro");
    }
  });

  document
    .getElementById("tabelaMensalidades")
    ?.addEventListener("click", async (e) => {
      const btnEdit = e.target.closest(".btn-edit-mensalidade");
      if (btnEdit) {
        const id = btnEdit.getAttribute("data-id");
        const m = state.mensalidadesAtuais.find((mens) => mens.id == id);
        if (m) {
          state.idMensalidadeEmEdicao = m.id;
          tituloModalPagamento.innerHTML =
            "<i class='bx bx-edit'></i> Editar Pagamento";
          document.getElementById("pagamentoMes").value = m.mes_ano;

          await prepararSelectSocios();

          if (inputSearch && inputId) {
            const datalist = document.getElementById("listaSocios");
            const options = Array.from(datalist.options);
            const optionToSelect = options.find(
              (opt) => opt.getAttribute("data-id") == m.socio_id,
            );
            if (optionToSelect) {
              inputSearch.value = optionToSelect.value;
              inputId.value = m.socio_id;
            }
          }

          document.getElementById("pagamentoTipo").value =
            m.tipo || "Mensalidade";
          document.getElementById("pagamentoValor").value = m.valor;
          document.getElementById("pagamentoEstado").value = m.estado;
          modalPagamento.classList.remove("hidden");
        }
        return;
      }

      // 🥊 ABRE O NOSSO NOVO MODAL DE ELIMINAÇÃO
      const btnDelete = e.target.closest(".btn-delete-mensalidade");
      if (btnDelete) {
        mensalidadeIdParaEliminar = btnDelete.getAttribute("data-id");
        modalDeleteMensalidade?.classList.remove("hidden");
      }
    });

  // 🥊 EVENTOS DO MODAL DE ELIMINAR MENSALIDADE
  btnCancelarDeleteMens?.addEventListener("click", () => {
    modalDeleteMensalidade.classList.add("hidden");
    mensalidadeIdParaEliminar = null;
  });

  btnConfirmarDeleteMens?.addEventListener("click", async () => {
    if (!mensalidadeIdParaEliminar) return;

    const textoOriginal = btnConfirmarDeleteMens.innerHTML;
    btnConfirmarDeleteMens.innerHTML =
      "A apagar... <i class='bx bx-loader-alt bx-spin'></i>";
    btnConfirmarDeleteMens.disabled = true;

    try {
      // 🥊 BLINDAGEM: Adicionamos o .select() no final.
      // Isto obriga o Supabase a devolver os dados da linha que apagou.
      const { data, error } = await supabase
        .from("mensalidades")
        .delete()
        .eq("id", mensalidadeIdParaEliminar)
        .select();

      if (error) throw error;

      // Se a data vier vazia, significa que o Supabase bloqueou o Delete por falta de permissões RLS!
      if (!data || data.length === 0) {
        throw new Error(
          "A base de dados bloqueou a eliminação. Verifica as tuas permissões de DELETE (RLS) no Supabase!",
        );
      }

      modalDeleteMensalidade.classList.add("hidden");

      // 🥊 GOLPE DE SINCRONIZAÇÃO: Adicionámos o 'await' para a tabela só atualizar quando a BD confirmar!
      await carregarMensalidades();
      await carregarGuerreiros();

      mostrarAviso(
        "Registo Eliminado",
        "A mensalidade foi apagada com sucesso.",
        "sucesso",
      );
    } catch (erro) {
      mostrarAviso("Erro ao Eliminar", erro.message, "erro");
    } finally {
      btnConfirmarDeleteMens.innerHTML = textoOriginal;
      btnConfirmarDeleteMens.disabled = false;
      mensalidadeIdParaEliminar = null;
    }
  });

  // -------------------------------------------------------------
  // PESQUISA NA TABELA DE MENSALIDADES
  // -------------------------------------------------------------
  const filtroNomeMensalidade = document.getElementById(
    "filtroNomeMensalidade",
  );
  const btnLimparMensalidade = document.getElementById("limparMensalidade");

  if (filtroNomeMensalidade) {
    // 🥊 OTIMIZAÇÃO: Debounce aplicado à caixa de pesquisa
    filtroNomeMensalidade.addEventListener(
      "input",
      debounce(() => {
        const termo = filtroNomeMensalidade.value.toLowerCase();
        if (btnLimparMensalidade)
          btnLimparMensalidade.style.display =
            termo.length > 0 ? "block" : "none";

        const filtrados = state.mensalidadesAtuais.filter((m) => {
          const nomeSocio = m.socios?.nome || "";
          return nomeSocio.toLowerCase().includes(termo);
        });
        renderizarTabelaMensalidades(filtrados);
      }, 300),
    ); // Espera 300ms antes de filtrar e renderizar

    if (btnLimparMensalidade) {
      btnLimparMensalidade.addEventListener("click", () => {
        filtroNomeMensalidade.value = "";
        btnLimparMensalidade.style.display = "none";
        renderizarTabelaMensalidades(state.mensalidadesAtuais);
        filtroNomeMensalidade.focus();
      });
    }

    filtroNomeMensalidade.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && filtroNomeMensalidade.value.length > 0) {
        btnLimparMensalidade.click();
      }
    });
  }

  // -------------------------------------------------------------
  // ATALHO DE ELITE: FATURAR A PARTIR DA TABELA DE SÓCIOS
  // -------------------------------------------------------------
  const tabelaSocios = document.getElementById("tabelaSocios");
  if (tabelaSocios) {
    tabelaSocios.addEventListener("click", async (e) => {
      const btnFaturar = e.target.closest(".btn-faturar");
      if (btnFaturar) {
        const socioId = btnFaturar.getAttribute("data-id");
        state.idMensalidadeEmEdicao = null;
        formNovoPagamento.reset();

        document.getElementById("pagamentoMes").value = document.getElementById(
          "filtroMesMensalidade",
        ).value;
        tituloModalPagamento.innerHTML =
          "<i class='bx bx-euro'></i> Registar Pagamento";

        await prepararSelectSocios();

        if (inputSearch && inputId) {
          const datalist = document.getElementById("listaSocios");
          const options = Array.from(datalist.options);
          const optionToSelect = options.find(
            (opt) => opt.getAttribute("data-id") == socioId,
          );
          if (optionToSelect) {
            inputSearch.value = optionToSelect.value;
            inputId.value = socioId;
          }
        }

        document.getElementById("pagamentoEstado").value = "Pago";
        modalPagamento.classList.remove("hidden");
      }
    });
  }
}
