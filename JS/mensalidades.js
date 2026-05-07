/* JS/mensalidades.js - GESTÃO DE MENSALIDADES (Modais Premium) */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { formatarNomeCurto, extrairPreco, debounce } from "./helpers.js";
import { carregarGuerreiros } from "./socios.js";
import { mostrarAviso } from "./main.js";

// 🥊 VARIÁVEIS DE CONTROLO DE PAGINAÇÃO
let paginaAtualMens = 1;
const ITENS_POR_PAGINA_MENS = 10;

export function renderizarTabelaMensalidades(lista, manterPagina = false) {
  const tabelaMensalidades = document.getElementById("tabelaMensalidades");
  const filtroMes = document.getElementById("filtroMesMensalidade");
  tabelaMensalidades.innerHTML = "";

  if (!manterPagina) paginaAtualMens = 1;

  let totalGeral = 0;
  const listaAtivos = lista.filter((m) => m.socios?.estado !== "Inativo");

  if (listaAtivos.length === 0) {
    tabelaMensalidades.innerHTML =
      '<tr><td colspan="7" style="text-align: center;">Nenhum registo de atletas ativos.</td></tr>';
    return;
  }

  listaAtivos.forEach((m) => {
    totalGeral += extrairPreco(m.valor);
  });

  const mesReferencia = filtroMes.value;
  const fragment = document.createDocumentFragment();

  const limiteAtual = paginaAtualMens * ITENS_POR_PAGINA_MENS;
  const listaPaginada = listaAtivos.slice(0, limiteAtual);

  listaPaginada.forEach((m) => {
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
      <td data-label="Valor" class="${classeNeon}">${m.valor}€</td>
      <td data-label="Estado"><span class="badge ${badgeClass}">${m.estado}</span></td>
      <td data-label="Ações">
          <button class="btn-acao btn-edit-mensalidade" data-id="${m.id}"><i class='bx bx-edit'></i></button>
          <button class="btn-acao btn-delete-mensalidade" data-id="${m.id}"><i class='bx bx-trash'></i></button>
      </td>`;
    fragment.appendChild(tr);
  });

  if (limiteAtual < listaAtivos.length) {
    const trMore = document.createElement("tr");
    trMore.innerHTML = `
      <td colspan="7" style="text-align: center; padding: 15px;">
        <button class="btn-tatico btn-small btn-carregar-mais-mens" style="width: 100%; border-color: var(--accent); color: var(--accent);">
          Carregar mais <i class='bx bx-chevron-down bx-fade-down'></i>
        </button>
      </td>`;
    fragment.appendChild(trMore);
  }

  const trTotal = document.createElement("tr");
  trTotal.style.background = "rgba(37, 211, 102, 0.1)";
  trTotal.innerHTML = `
    <td colspan="4" style="text-align: right; font-weight: bold; color: var(--accent);">TOTAL FATURADO (ATIVOS):</td>
    <td style="font-weight: bold; color: var(--accent);">${totalGeral.toFixed(2)}€</td>
    <td colspan="2"></td>
  `;
  fragment.appendChild(trTotal);
  tabelaMensalidades.appendChild(fragment);
}

export async function carregarMensalidades() {
  const tabelaMensalidades = document.getElementById("tabelaMensalidades");
  const filtroMes = document.getElementById("filtroMesMensalidade");
  tabelaMensalidades.innerHTML =
    '<tr><td colspan="7">A carregar registos...</td></tr>';

  const { data: mensalidades, error } = await supabase
    .from("mensalidades")
    .select(
      `id, mes_ano, valor, estado, tipo, socio_id, socios ( nome, modalidade, telemovel, data_inscricao, estado )`,
    )
    .eq("mes_ano", filtroMes.value);

  if (error) {
    console.error(error);
    tabelaMensalidades.innerHTML =
      '<tr><td colspan="7">Erro ao carregar mensalidades.</td></tr>';
    return;
  }

  if (mensalidades) {
    const apenasAtivos = mensalidades.filter(
      (m) => m.socios?.estado !== "Inativo",
    );

    apenasAtivos.sort((a, b) => {
      const nomeA = a.socios?.nome || "";
      const nomeB = b.socios?.nome || "";
      const partesA = nomeA.trim().split(" ");
      const partesB = nomeB.trim().split(" ");
      const pA = partesA[0].toLowerCase();
      const pB = partesB[0].toLowerCase();
      const uA = partesA[partesA.length - 1].toLowerCase();
      const uB = partesB[partesB.length - 1].toLowerCase();
      if (pA < pB) return -1;
      if (pA > pB) return 1;
      return uA < uB ? -1 : 1;
    });

    state.mensalidadesAtuais = apenasAtivos;
    paginaAtualMens = 1;
    renderizarTabelaMensalidades(apenasAtivos);

    const totalArrecadado = apenasAtivos
      .filter((m) => m.estado === "Pago")
      .reduce((soma, m) => soma + (parseFloat(m.valor) || 0), 0);
    const elReceita = document.getElementById("totalMensalidade");
    if (elReceita) elReceita.innerText = totalArrecadado.toFixed(2) + " €";
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
      const option = document.createElement("option");
      option.value = `${s.nome}${s.estado === "Inativo" ? " (Inativo)" : ""}`;
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
  const modalDeleteMensalidade = document.getElementById(
    "modalConfirmDeleteMensalidade",
  );
  const inputSearch = document.getElementById("pagamentoSocioSearch");
  const inputId = document.getElementById("pagamentoSocioId");
  let mensalidadeIdParaEliminar = null;

  document
    .getElementById("tabelaMensalidades")
    ?.addEventListener("click", async (e) => {
      const btnMore = e.target.closest(".btn-carregar-mais-mens");
      if (btnMore) {
        paginaAtualMens++;
        const termo = document
          .getElementById("filtroNomeMensalidade")
          ?.value.toLowerCase();
        const lista = termo
          ? state.mensalidadesAtuais.filter((m) =>
              (m.socios?.nome || "").toLowerCase().includes(termo),
            )
          : state.mensalidadesAtuais;
        renderizarTabelaMensalidades(lista, true);
        return;
      }

      const btnEdit = e.target.closest(".btn-edit-mensalidade");
      if (btnEdit) {
        const m = state.mensalidadesAtuais.find(
          (item) => item.id == btnEdit.dataset.id,
        );
        if (m) {
          state.idMensalidadeEmEdicao = m.id;
          inputSearch.value = m.socios.nome;
          inputId.value = m.socio_id;
          document.getElementById("pagamentoMes").value = m.mes_ano;
          document.getElementById("pagamentoValor").value = m.valor;
          document.getElementById("pagamentoEstado").value = m.estado;
          document.getElementById("pagamentoTipo").value =
            m.tipo || "Mensalidade";
          tituloModalPagamento.innerHTML =
            "<i class='bx bx-edit'></i> Editar Pagamento";
          modalPagamento.classList.remove("hidden");
        }
      }

      const btnDel = e.target.closest(".btn-delete-mensalidade");
      if (btnDel) {
        mensalidadeIdParaEliminar = btnDel.dataset.id;
        modalDeleteMensalidade.classList.remove("hidden");
      }
    });

  document
    .getElementById("btnCancelarDeleteMensalidade")
    ?.addEventListener("click", () =>
      modalDeleteMensalidade.classList.add("hidden"),
    );
  document
    .getElementById("btnConfirmarDeleteMensalidade")
    ?.addEventListener("click", async () => {
      if (mensalidadeIdParaEliminar) {
        const { error } = await supabase
          .from("mensalidades")
          .delete()
          .eq("id", mensalidadeIdParaEliminar);
        if (!error) {
          mostrarAviso("Eliminado", "Registo apagado.", "sucesso");
          modalDeleteMensalidade.classList.add("hidden");
          carregarMensalidades();
        }
      }
    });

  inputSearch?.addEventListener("input", (e) => {
    const opt = Array.from(
      document.getElementById("listaSocios")?.options || [],
    ).find((o) => o.value === e.target.value);
    inputId.value = opt ? opt.getAttribute("data-id") : "";
  });

  document
    .getElementById("btnAddPagamento")
    ?.addEventListener("click", async () => {
      state.idMensalidadeEmEdicao = null;
      formNovoPagamento.reset();
      inputId.value = "";
      document.getElementById("pagamentoMes").value = document.getElementById(
        "filtroMesMensalidade",
      ).value;
      tituloModalPagamento.innerHTML =
        "<i class='bx bx-euro'></i> Registar Pagamento";
      await prepararSelectSocios();
      modalPagamento.classList.remove("hidden");
    });

  formNovoPagamento?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!inputId.value) {
      mostrarAviso("Atenção", "Sócio inválido!", "erro");
      return;
    }

    const isEdicao = !!state.idMensalidadeEmEdicao; // 🥊 IDENTIFICA SE É EDIÇÃO
    const dados = {
      socio_id: inputId.value,
      mes_ano: document.getElementById("pagamentoMes").value,
      valor: parseFloat(
        document
          .getElementById("pagamentoValor")
          .value.toString()
          .replace("€", "")
          .replace(",", ".")
          .trim(),
      ),
      estado: document.getElementById("pagamentoEstado").value,
      tipo: document.getElementById("pagamentoTipo").value,
    };

    try {
      if (isEdicao) {
        await supabase
          .from("mensalidades")
          .update(dados)
          .eq("id", state.idMensalidadeEmEdicao);
      } else {
        await supabase.from("mensalidades").insert([dados]);
      }

      if (dados.estado === "Pago") {
        await supabase
          .from("socios")
          .update({ estado: "Ativo" })
          .eq("id", dados.socio_id);

        // 🥊 SÓ ENVIA NOTIFICAÇÃO SE FOR UM NOVO REGISTO
        if (!isEdicao) {
          const t = "Mensalidade Validada";
          const m = `O teu pagamento referente a ${dados.mes_ano} foi validado.`;
          await supabase
            .from("notificacoes")
            .insert([
              { socio_id: dados.socio_id, titulo: t, mensagem: m, lida: false },
            ]);
          try {
            await supabase.functions.invoke("notificar-alvo", {
              body: {
                socio_id: parseInt(dados.socio_id),
                titulo: t,
                mensagem: m,
              },
            });
          } catch (e) {}

          mostrarAviso(
            "Faturado!",
            "Mensalidade registada e atleta notificado.",
            "sucesso",
          );
        } else {
          mostrarAviso(
            "Atualizado",
            "Dados da mensalidade atualizados com sucesso.",
            "sucesso",
          );
        }
      } else {
        mostrarAviso(
          "Sucesso",
          isEdicao ? "Atualizado com sucesso." : "Dívida registada.",
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
}
