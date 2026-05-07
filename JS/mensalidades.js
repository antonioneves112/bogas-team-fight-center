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
      <td data-label="Valor" class="${classeNeon}">${m.valor}€</td>
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

  const { data: mensalidades, error } = await supabase
    .from("mensalidades")
    .select(
      `
      id,
      mes_ano,
      valor,
      estado,
      tipo,
      socio_id,
      socios (
        nome,
        modalidade,
        telemovel,
        data_inscricao,
        estado
      )
    `,
    )
    .eq("mes_ano", mesReferencia);

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

    // 🥊 ORDENAÇÃO ALFABÉTICA
    apenasAtivos.sort((a, b) => {
      const nomeA = a.socios?.nome || "";
      const nomeB = b.socios?.nome || "";

      const partesA = nomeA.trim().split(" ");
      const partesB = nomeB.trim().split(" ");

      const primeiroA = partesA[0].toLowerCase();
      const primeiroB = partesB[0].toLowerCase();

      const ultimoA = partesA[partesA.length - 1].toLowerCase();
      const ultimoB = partesB[partesB.length - 1].toLowerCase();

      if (primeiroA < primeiroB) return -1;
      if (primeiroA > primeiroB) return 1;

      if (ultimoA < ultimoB) return -1;
      if (ultimoA > ultimoB) return 1;

      return 0;
    });

    state.mensalidadesAtuais = apenasAtivos;

    renderizarTabelaMensalidades(apenasAtivos);

    const totalArrecadado = apenasAtivos
      .filter((m) => m.estado === "Pago")
      .reduce((soma, m) => soma + (parseFloat(m.valor) || 0), 0);

    const elReceita = document.getElementById("totalMensalidade");

    if (elReceita) {
      elReceita.innerText = totalArrecadado.toFixed(2) + " €";
    }
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
      valor: valorLimpoManual,
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
}
