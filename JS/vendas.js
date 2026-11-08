/* JS/vendas.js - GESTÃO DE VENDAS E STOCK (dashboard dos treinadores)
 *
 * Toda a lógica que mexe em dinheiro ou stock corre na BASE DE DADOS, numa só
 * transação (supabase/migracoes/03_vendas_stock.sql):
 *   registar_venda, anular_venda, marcar_venda_paga, repor_stock, guardar_produto.
 * Este ficheiro só mostra os dados e chama essas funções.
 */
import { supabase, db } from "./supabase.js";
import { state } from "./state.js";
import { escapeHTML, MESES_PT, dataLocalISO, mesLocalISO, debounce, mostrar } from "./helpers.js";
import { mostrarAviso } from "./toast.js";

const e = escapeHTML;
const $ = (id) => document.getElementById(id);
const euros = (v) => `${(Number(v) || 0).toFixed(2)}€`;

const CATEGORIAS_SUGERIDAS = [
  "Luvas",
  "Proteções",
  "Ligaduras",
  "Protetores bucais",
  "Vestuário",
  "Calções",
  "Merchandising",
  "Acessórios",
  "Outros",
];
const ORDEM_TAMANHOS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

const ERROS = {
  SEM_PERMISSAO: "Não tens permissão para esta operação.",
  VENDA_VAZIA: "Adiciona pelo menos um artigo ao carrinho.",
  CLIENTE_EM_FALTA: "Indica o nome do cliente.",
  SOCIO_NAO_ENCONTRADO: "Sócio não encontrado. Escolhe-o da lista.",
  METODO_EM_FALTA: "Escolhe o método de pagamento.",
  QUANTIDADE_INVALIDA: "Quantidade inválida.",
  PRECO_INVALIDO: "Preço inválido.",
  NOME_EM_FALTA: "Indica o nome do produto.",
  SEM_VARIANTES: "Adiciona pelo menos uma variante (ex.: Tamanho único).",
  VARIANTE_SEM_NOME: "Todas as variantes têm de ter nome.",
  VARIANTE_REPETIDA: "Há variantes com o mesmo nome.",
  VARIANTE_COM_VENDAS: "Não podes apagar uma variante que já foi vendida.",
  STOCK_INVALIDO: "O stock inicial não pode ser negativo.",
  VENDA_JA_ANULADA: "Esta venda já estava anulada.",
  VENDA_NAO_PENDENTE: "Esta venda já não está pendente.",
};

function mensagemErro(err) {
  const msg = err?.message || "";
  if (msg.includes("STOCK_INSUFICIENTE")) {
    const detalhe = msg.split("STOCK_INSUFICIENTE")[1]?.replace(/^:\s*/, "");
    return detalhe ? `Stock insuficiente: ${detalhe}` : "Stock insuficiente para essa operação.";
  }
  const codigo = Object.keys(ERROS).find((c) => msg.includes(c));
  if (codigo) return ERROS[codigo];
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(err?.code) || /does not exist|Could not find/.test(msg)) {
    return "O módulo de vendas ainda não está ativo na base de dados (falta correr 03_vendas_stock.sql).";
  }
  return msg || "Erro desconhecido.";
}

// ---------------------------------------------------------------------------
// ESTADO DO MÓDULO
// ---------------------------------------------------------------------------
let produtos = [];
let vendas = [];
let carrinho = [];
let sociosVenda = [];
let vendaSelecionada = null;
let produtoStock = null;

function mesSelecionado() {
  return $("filtroMesMensalidade")?.value || mesLocalISO();
}

function limitesDoMes(mes) {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return [`${mes}-01`, `${mes}-${String(ultimo).padStart(2, "0")}`];
}

function ordenarVariantes(a, b) {
  const ia = ORDEM_TAMANHOS.indexOf(a.nome.toUpperCase());
  const ib = ORDEM_TAMANHOS.indexOf(b.nome.toUpperCase());
  if (ia > -1 && ib > -1) return ia - ib;
  if (ia > -1) return -1;
  if (ib > -1) return 1;
  return a.nome.localeCompare(b.nome, "pt", { numeric: true });
}

const stockTotal = (p) => p.produto_variantes.reduce((s, v) => s + v.stock, 0);
const varianteBaixa = (p, v) => v.stock <= p.stock_minimo;
const produtoComStockBaixo = (p) => p.ativo && p.produto_variantes.some((v) => varianteBaixa(p, v));

// ---------------------------------------------------------------------------
// CARREGAR DADOS
// ---------------------------------------------------------------------------
export async function carregarVendasEStock() {
  const [inicio, fim] = limitesDoMes(mesSelecionado());
  try {
    const [respProdutos, respVendas] = await Promise.all([
      supabase
        .from("produtos")
        .select("id, nome, categoria, preco_compra, preco_venda, stock_minimo, ativo, produto_variantes(id, nome, stock)")
        .order("nome"),
      supabase
        .from("vendas")
        .select("id, data, socio_id, cliente_nome, estado, metodo, total, custo_total, notas, venda_itens(produto_nome, variante_nome, quantidade, preco_unitario)")
        .gte("data", inicio)
        .lte("data", fim)
        .order("data", { ascending: false })
        .order("id", { ascending: false }),
    ]);
    if (respProdutos.error) throw respProdutos.error;
    if (respVendas.error) throw respVendas.error;

    produtos = respProdutos.data.map((p) => ({
      ...p,
      produto_variantes: [...(p.produto_variantes || [])].sort(ordenarVariantes),
    }));
    vendas = respVendas.data;

    atualizarTitulo();
    renderizarResumo();
    renderizarVendas();
    renderizarProdutos();
    preencherCategorias();
  } catch (err) {
    const linha = `<tr><td colspan="7" class="celula-erro">${e(mensagemErro(err))}</td></tr>`;
    $("tabelaVendas").innerHTML = linha;
    $("tabelaProdutos").innerHTML = linha;
  }
}

function atualizarTitulo() {
  const [ano, mes] = mesSelecionado().split("-");
  // Curto para caber no telemóvel; o ano está no seletor do mês.
  $("tituloVendas").textContent = `Vendas — ${MESES_PT[Number(mes) - 1]}`;
}

// ---------------------------------------------------------------------------
// RENDERIZAÇÃO
// ---------------------------------------------------------------------------
function renderizarResumo() {
  const ativas = vendas.filter((v) => v.estado !== "Anulada");
  const receita = ativas.reduce((s, v) => s + Number(v.total), 0);
  const lucro = ativas
    .filter((v) => v.estado === "Paga")
    .reduce((s, v) => s + Number(v.total) - Number(v.custo_total), 0);
  const porCobrar = ativas.filter((v) => v.estado === "Pendente").reduce((s, v) => s + Number(v.total), 0);
  const stockBaixo = produtos.filter(produtoComStockBaixo).length;

  $("vendasReceita").textContent = euros(receita);
  $("vendasLucro").textContent = euros(lucro);
  $("vendasPorCobrar").textContent = euros(porCobrar);
  $("vendasStockBaixo").textContent = String(stockBaixo);
  $("cartaoStockBaixo").classList.toggle("tem-alerta", stockBaixo > 0);
}

function resumoArtigos(venda) {
  return (venda.venda_itens || [])
    .map((i) => `${i.quantidade}× ${i.produto_nome}${i.variante_nome !== "Único" ? ` (${i.variante_nome})` : ""}`)
    .join(", ");
}

function renderizarVendas() {
  const tabela = $("tabelaVendas");
  const termo = ($("filtroVendas")?.value || "").trim().toLowerCase();
  const lista = termo
    ? vendas.filter((v) => `${v.cliente_nome} ${resumoArtigos(v)}`.toLowerCase().includes(termo))
    : vendas;

  if (!lista.length) {
    tabela.innerHTML = `<tr><td colspan="7" class="table-empty-state">${termo ? "Nenhuma venda encontrada." : "Ainda não há vendas neste mês."}</td></tr>`;
    return;
  }

  const classeEstado = { Paga: "badge-pago", Pendente: "badge-pendente", Anulada: "badge-inativo" };
  tabela.innerHTML = lista
    .map((v) => {
      const anulada = v.estado === "Anulada";
      const lucro = Number(v.total) - Number(v.custo_total);
      const acoes = [
        v.estado === "Pendente"
          ? `<button class="btn-acao btn-edit btn-receber-venda" data-id="${e(v.id)}" title="Receber pagamento"><i class='bx bx-check'></i></button>`
          : "",
        !anulada
          ? `<button class="btn-acao btn-delete btn-anular-venda" data-id="${e(v.id)}" title="Anular venda"><i class='bx bx-undo'></i></button>`
          : "",
      ].join("");
      return `
      <tr class="${anulada ? "venda-anulada" : ""}">
        <td data-label="Data">${e(String(v.data).split("-").reverse().join("/"))}</td>
        <td data-label="Cliente">${e(v.cliente_nome)}${v.socio_id ? " <i class='bx bx-id-card venda-icone-socio' title='Sócio'></i>" : ""}</td>
        <td data-label="Artigos">${e(resumoArtigos(v))}${v.notas ? `<div class="venda-notas">${e(v.notas)}</div>` : ""}</td>
        <td data-label="Total"><strong>${euros(v.total)}</strong></td>
        <td data-label="Lucro" class="${anulada ? "" : lucro >= 0 ? "texto-destaque" : "celula-saida"}">${anulada ? "—" : euros(lucro)}</td>
        <td data-label="Estado"><span class="badge ${classeEstado[v.estado] || ""}">${e(v.estado)}</span>${v.metodo && !anulada ? `<div class="venda-metodo">${e(v.metodo)}</div>` : ""}</td>
        <td data-label="Ações"><div class="acoes-linha">${acoes || "—"}</div></td>
      </tr>`;
    })
    .join("");
}

function renderizarProdutos() {
  const tabela = $("tabelaProdutos");
  const termo = ($("filtroProdutos")?.value || "").trim().toLowerCase();
  const categoria = $("filtroCategoria")?.value || "";
  const soBaixo = $("filtroStockBaixo")?.checked;
  const verArquivados = $("filtroArquivados")?.checked;

  const lista = produtos.filter(
    (p) =>
      (verArquivados || p.ativo) &&
      (!termo || p.nome.toLowerCase().includes(termo)) &&
      (!categoria || p.categoria === categoria) &&
      (!soBaixo || produtoComStockBaixo(p)),
  );

  if (!lista.length) {
    tabela.innerHTML = `<tr><td colspan="7" class="table-empty-state">${produtos.length ? "Nenhum produto com estes filtros." : "Ainda não tens produtos. Carrega em <i class='bx bx-package'></i> para criar o primeiro."}</td></tr>`;
    return;
  }

  tabela.innerHTML = lista
    .map((p) => {
      const compra = Number(p.preco_compra);
      const venda = Number(p.preco_venda);
      const margem = venda - compra;
      const pct = venda > 0 ? Math.round((margem / venda) * 100) : 0;
      // Só os tamanhos COM stock (mais limpo no telemóvel). Os esgotados ficam na dica
      // e na janela de stock; se não houver nenhum, mostra só "Esgotado".
      const comStock = p.produto_variantes.filter((v) => v.stock > 0);
      const esgotados = p.produto_variantes.filter((v) => v.stock === 0).map((v) => v.nome);
      const unico = p.produto_variantes.length === 1 && p.produto_variantes[0].nome === "Único";
      const chips = comStock.length
        ? comStock
            .map((v) => {
              const classe = varianteBaixa(p, v) ? "stock-baixo" : "";
              return `<span class="stock-chip ${classe}">${unico ? "" : `${e(v.nome)}: `}${e(v.stock)}</span>`;
            })
            .join("")
        : `<span class="stock-chip stock-zero">Esgotado</span>`;
      const dicaStock = esgotados.length && comStock.length ? ` title="Esgotado: ${e(esgotados.join(", "))}"` : "";
      return `
      <tr class="${p.ativo ? "" : "produto-arquivado"}">
        <td data-label="Produto"><strong>${e(p.nome)}</strong>${p.ativo ? "" : " <span class='badge badge-inativo'>Arquivado</span>"}</td>
        <td data-label="Categoria">${e(p.categoria)}</td>
        <td data-label="Compra">${euros(compra)}</td>
        <td data-label="Venda">${euros(venda)}</td>
        <td data-label="Margem" class="${margem >= 0 ? "texto-destaque" : "celula-saida"}"><span>${euros(margem)} <small>(${pct}%)</small></span></td>
        <td data-label="Stock"><div class="stock-celula"${dicaStock}><div class="stock-chips">${chips}</div>${comStock.length && !unico ? `<small class="stock-total">Total: ${stockTotal(p)}</small>` : ""}</div></td>
        <td data-label="Ações">
          <div class="acoes-linha">
            <button class="btn-acao btn-edit btn-editar-produto" data-id="${e(p.id)}" title="Editar produto"><i class='bx bx-edit'></i></button>
            <button class="btn-acao btn-edit btn-stock-produto" data-id="${e(p.id)}" title="Entrada / ajuste de stock"><i class='bx bx-transfer-alt'></i></button>
            <button class="btn-acao btn-delete btn-arquivar-produto" data-id="${e(p.id)}" title="${p.ativo ? "Arquivar (deixa de aparecer nas vendas)" : "Reativar"}"><i class='bx ${p.ativo ? "bx-archive-in" : "bx-archive-out"}'></i></button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function preencherCategorias() {
  const usadas = [...new Set(produtos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, "pt"));
  const filtro = $("filtroCategoria");
  const atual = filtro.value;
  filtro.innerHTML =
    `<option value="">Todas as categorias</option>` +
    usadas.map((c) => `<option value="${e(c)}">${e(c)}</option>`).join("");
  filtro.value = usadas.includes(atual) ? atual : "";

  const sugestoes = [...new Set([...CATEGORIAS_SUGERIDAS, ...usadas])];
  $("listaCategorias").innerHTML = sugestoes.map((c) => `<option value="${e(c)}"></option>`).join("");
}

// ---------------------------------------------------------------------------
// NOVA VENDA (carrinho)
// ---------------------------------------------------------------------------
const reservadoNoCarrinho = (varianteId) =>
  carrinho.filter((i) => i.variante_id === varianteId).reduce((s, i) => s + i.quantidade, 0);

async function abrirNovaVenda() {
  carrinho = [];
  $("formNovaVenda").reset();
  $("vendaSocioId").value = "";
  $("vendaData").value = dataLocalISO();
  alternarTipoCliente();
  alternarMetodo();
  renderizarCarrinho();

  const ativos = produtos.filter((p) => p.ativo);
  $("vendaProduto").innerHTML =
    `<option value="">${ativos.length ? "Escolhe um produto..." : "Cria primeiro um produto"}</option>` +
    ativos
      .map((p) => `<option value="${e(p.id)}"${stockTotal(p) === 0 ? " disabled" : ""}>${e(p.nome)} — ${euros(p.preco_venda)}${stockTotal(p) === 0 ? " (esgotado)" : ""}</option>`)
      .join("");
  preencherVariantes();
  mostrar($("modalNovaVenda"), true);

  try {
    sociosVenda = await db(
      supabase.from("socios").select("id, nome, estado").neq("estado", "Inativo").order("nome"),
    );
    const contagem = sociosVenda.reduce((m, s) => m.set(s.nome, (m.get(s.nome) || 0) + 1), new Map());
    sociosVenda = sociosVenda.map((s) => ({ ...s, rotulo: contagem.get(s.nome) > 1 ? `${s.nome} (#${s.id})` : s.nome }));
    $("listaSociosVenda").innerHTML = sociosVenda.map((s) => `<option value="${e(s.rotulo)}"></option>`).join("");
  } catch (err) {
    mostrarAviso("Aviso", "Não foi possível carregar a lista de sócios.", "erro");
  }
}

function alternarTipoCliente() {
  const externo = document.querySelector('input[name="tipoCliente"]:checked')?.value === "externo";
  mostrar($("grupoClienteSocio"), !externo);
  mostrar($("grupoClienteExterno"), externo);
}

function alternarMetodo() {
  mostrar($("grupoVendaMetodo"), $("vendaEstado").value === "Paga");
}

function produtoPorId(id) {
  return produtos.find((p) => String(p.id) === String(id));
}

function preencherVariantes() {
  const produto = produtoPorId($("vendaProduto").value);
  const select = $("vendaVariante");
  if (!produto) {
    select.innerHTML = "";
    select.disabled = true;
    $("vendaPreco").value = "";
    return;
  }
  select.disabled = false;
  select.innerHTML = produto.produto_variantes
    .map((v) => {
      const disponivel = v.stock - reservadoNoCarrinho(v.id);
      return `<option value="${e(v.id)}"${disponivel <= 0 ? " disabled" : ""}>${e(v.nome)} — ${disponivel > 0 ? `${disponivel} em stock` : "esgotado"}</option>`;
    })
    .join("");
  const primeiraDisponivel = [...select.options].find((o) => !o.disabled);
  if (primeiraDisponivel) select.value = primeiraDisponivel.value;
  $("vendaPreco").value = Number(produto.preco_venda).toFixed(2);
  $("vendaQuantidade").value = 1;
}

function adicionarAoCarrinho() {
  const produto = produtoPorId($("vendaProduto").value);
  if (!produto) return mostrarAviso("Atenção", "Escolhe um produto.", "erro");
  const variante = produto.produto_variantes.find((v) => String(v.id) === $("vendaVariante").value);
  if (!variante) return mostrarAviso("Atenção", "Escolhe o tamanho / variante.", "erro");

  const quantidade = parseInt($("vendaQuantidade").value, 10);
  const preco = parseFloat(String($("vendaPreco").value).replace(",", "."));
  if (!Number.isInteger(quantidade) || quantidade < 1) return mostrarAviso("Atenção", ERROS.QUANTIDADE_INVALIDA, "erro");
  if (isNaN(preco) || preco < 0) return mostrarAviso("Atenção", ERROS.PRECO_INVALIDO, "erro");

  const disponivel = variante.stock - reservadoNoCarrinho(variante.id);
  if (quantidade > disponivel) {
    return mostrarAviso("Stock insuficiente", `${produto.nome} (${variante.nome}): só há ${disponivel} disponível.`, "erro");
  }

  const existente = carrinho.find((i) => i.variante_id === variante.id && i.preco_unitario === preco);
  if (existente) existente.quantidade += quantidade;
  else
    carrinho.push({
      variante_id: variante.id,
      produto: produto.nome,
      variante: variante.nome,
      quantidade,
      preco_unitario: preco,
      custo_unitario: Number(produto.preco_compra),
    });

  renderizarCarrinho();
  $("vendaProduto").value = "";
  preencherVariantes();
}

function renderizarCarrinho() {
  const lista = $("vendaCarrinho");
  if (!carrinho.length) {
    lista.innerHTML = '<li class="vendas-carrinho-vazio">Ainda não adicionaste artigos.</li>';
  } else {
    lista.innerHTML = carrinho
      .map(
        (i, indice) => `
      <li class="vendas-carrinho-item">
        <div>
          <strong>${e(i.produto)}</strong>${i.variante !== "Único" ? ` <span class="stock-chip">${e(i.variante)}</span>` : ""}
          <small>${i.quantidade} × ${euros(i.preco_unitario)}</small>
        </div>
        <span class="vendas-carrinho-subtotal">${euros(i.quantidade * i.preco_unitario)}</span>
        <button type="button" class="btn-acao btn-delete btn-remover-artigo" data-indice="${indice}" title="Remover"><i class='bx bx-x'></i></button>
      </li>`,
      )
      .join("");
  }
  const total = carrinho.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const custo = carrinho.reduce((s, i) => s + i.quantidade * i.custo_unitario, 0);
  $("vendaTotal").textContent = euros(total);
  $("vendaLucro").textContent = euros(total - custo);
}

async function submeterVenda(ev) {
  ev.preventDefault();
  const btn = $("btnRegistarVenda");
  if (btn.disabled) return;

  if (!carrinho.length) return mostrarAviso("Atenção", ERROS.VENDA_VAZIA, "erro");
  const externo = document.querySelector('input[name="tipoCliente"]:checked')?.value === "externo";
  let socioId = null;
  let clienteNome = null;
  if (externo) {
    clienteNome = $("vendaClienteNome").value.trim();
    if (!clienteNome) return mostrarAviso("Atenção", ERROS.CLIENTE_EM_FALTA, "erro");
  } else {
    const escolhido = sociosVenda.find((s) => s.rotulo === $("vendaSocioPesquisa").value);
    if (!escolhido) return mostrarAviso("Atenção", ERROS.SOCIO_NAO_ENCONTRADO, "erro");
    socioId = escolhido.id;
  }
  const estado = $("vendaEstado").value;

  const textoOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "A registar... <i class='bx bx-loader-alt bx-spin'></i>";
  try {
    await db(
      supabase.rpc("registar_venda", {
        p_itens: carrinho.map((i) => ({
          variante_id: i.variante_id,
          quantidade: i.quantidade,
          preco_unitario: i.preco_unitario,
        })),
        p_socio_id: socioId,
        p_cliente_nome: clienteNome,
        p_estado: estado,
        p_metodo: estado === "Paga" ? $("vendaMetodo").value : null,
        p_data: $("vendaData").value || dataLocalISO(),
        p_notas: $("vendaNotas").value.trim() || null,
        p_treinador: state.treinadorAtual || null,
      }),
    );
    mostrarAviso("Venda registada", estado === "Paga" ? "Pagamento recebido e stock atualizado." : "Venda registada como pendente.", "sucesso");
    mostrar($("modalNovaVenda"), false);
    carrinho = [];
    await carregarVendasEStock();
  } catch (err) {
    mostrarAviso("Erro na venda", mensagemErro(err), "erro");
  } finally {
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
  }
}

// ---------------------------------------------------------------------------
// PRODUTO (criar / editar)
// ---------------------------------------------------------------------------
function linhaVariante({ id = "", nome = "", stock = 0 } = {}) {
  const existente = id !== "";
  const linha = document.createElement("div");
  linha.className = "vendas-variante-linha";
  linha.dataset.id = id;
  linha.innerHTML = `
    <input type="text" class="variante-nome" maxlength="20" placeholder="Ex: M ou 12oz" value="${e(nome)}" aria-label="Nome da variante">
    ${
      existente
        ? `<span class="variante-stock-atual" title="Altera no botão de stock">Stock: ${e(stock)}</span>`
        : `<input type="number" class="variante-stock" min="0" step="1" value="${e(stock)}" aria-label="Stock inicial">`
    }
    <button type="button" class="btn-acao btn-delete btn-remover-variante" title="Remover variante"><i class='bx bx-x'></i></button>`;
  return linha;
}

function abrirProduto(produto = null) {
  $("formProduto").reset();
  $("produtoId").value = produto ? produto.id : "";
  $("tituloModalProduto").innerHTML = produto
    ? "<i class='bx bx-edit'></i> Editar Produto"
    : "<i class='bx bx-package'></i> Novo Produto";
  $("produtoNome").value = produto?.nome || "";
  $("produtoCategoria").value = produto?.categoria || "";
  $("produtoPrecoCompra").value = produto ? Number(produto.preco_compra).toFixed(2) : "";
  $("produtoPrecoVenda").value = produto ? Number(produto.preco_venda).toFixed(2) : "";
  $("produtoStockMinimo").value = produto ? produto.stock_minimo : 2;

  const lista = $("listaVariantes");
  lista.replaceChildren();
  (produto ? produto.produto_variantes : [{ nome: "Único", stock: 0 }]).forEach((v) =>
    lista.appendChild(linhaVariante(produto ? v : { nome: v.nome, stock: v.stock })),
  );
  atualizarMargem();
  mostrar($("modalProduto"), true);
}

function atualizarMargem() {
  const compra = parseFloat($("produtoPrecoCompra").value);
  const venda = parseFloat($("produtoPrecoVenda").value);
  const el = $("produtoMargem");
  if (isNaN(compra) || isNaN(venda)) {
    el.textContent = "Margem: --";
    el.classList.remove("margem-negativa");
    return;
  }
  const margem = venda - compra;
  const pct = venda > 0 ? Math.round((margem / venda) * 100) : 0;
  el.textContent = `Margem: ${euros(margem)} por unidade (${pct}%)`;
  el.classList.toggle("margem-negativa", margem < 0);
}

function aplicarPredefinicao(nomes) {
  const lista = $("listaVariantes");
  // Remove a linha "Único" nova e vazia, se for a única, para dar lugar aos tamanhos.
  const linhas = [...lista.children];
  if (nomes.length > 1 && linhas.length === 1 && !linhas[0].dataset.id && linhas[0].querySelector(".variante-nome").value === "Único") {
    lista.replaceChildren();
  }
  const existentes = new Set([...lista.querySelectorAll(".variante-nome")].map((i) => i.value.trim().toLowerCase()));
  nomes.forEach((nome) => {
    if (!existentes.has(nome.toLowerCase())) lista.appendChild(linhaVariante({ nome, stock: 0 }));
  });
}

async function submeterProduto(ev) {
  ev.preventDefault();
  const btn = $("btnGuardarProduto");
  if (btn.disabled) return;

  const variantes = [...$("listaVariantes").children].map((linha) => ({
    id: linha.dataset.id ? Number(linha.dataset.id) : null,
    nome: linha.querySelector(".variante-nome").value.trim(),
    stock: linha.dataset.id ? undefined : parseInt(linha.querySelector(".variante-stock")?.value || "0", 10),
  }));
  if (!variantes.length) return mostrarAviso("Atenção", ERROS.SEM_VARIANTES, "erro");
  if (variantes.some((v) => !v.nome)) return mostrarAviso("Atenção", ERROS.VARIANTE_SEM_NOME, "erro");
  const nomes = variantes.map((v) => v.nome.toLowerCase());
  if (new Set(nomes).size !== nomes.length) return mostrarAviso("Atenção", ERROS.VARIANTE_REPETIDA, "erro");
  if (variantes.some((v) => v.stock !== undefined && (isNaN(v.stock) || v.stock < 0))) {
    return mostrarAviso("Atenção", ERROS.STOCK_INVALIDO, "erro");
  }

  const id = $("produtoId").value;
  btn.disabled = true;
  try {
    await db(
      supabase.rpc("guardar_produto", {
        p_id: id ? Number(id) : null,
        p_nome: $("produtoNome").value.trim(),
        p_categoria: $("produtoCategoria").value.trim(),
        p_preco_compra: parseFloat($("produtoPrecoCompra").value),
        p_preco_venda: parseFloat($("produtoPrecoVenda").value),
        p_stock_minimo: parseInt($("produtoStockMinimo").value, 10),
        p_variantes: variantes,
      }),
    );
    mostrarAviso("Produto guardado", `${$("produtoNome").value.trim()} foi ${id ? "atualizado" : "criado"}.`, "sucesso");
    mostrar($("modalProduto"), false);
    await carregarVendasEStock();
  } catch (err) {
    mostrarAviso("Erro no produto", mensagemErro(err), "erro");
  } finally {
    btn.disabled = false;
  }
}

async function alternarArquivo(produto) {
  try {
    await db(supabase.from("produtos").update({ ativo: !produto.ativo }).eq("id", produto.id));
    mostrarAviso(
      produto.ativo ? "Produto arquivado" : "Produto reativado",
      produto.ativo ? `${produto.nome} deixa de aparecer nas vendas.` : `${produto.nome} volta a estar à venda.`,
      "sucesso",
    );
    await carregarVendasEStock();
  } catch (err) {
    mostrarAviso("Erro", mensagemErro(err), "erro");
  }
}

// ---------------------------------------------------------------------------
// STOCK (entradas / ajustes + histórico)
// ---------------------------------------------------------------------------
async function abrirStock(produto) {
  produtoStock = produto;
  $("formStock").reset();
  $("stockProdutoNome").textContent = produto.nome;
  $("stockVariante").innerHTML = produto.produto_variantes
    .map((v) => `<option value="${e(v.id)}">${e(v.nome)} — ${e(v.stock)} em stock</option>`)
    .join("");
  $("listaMovimentos").innerHTML = "<li>A carregar...</li>";
  mostrar($("modalStock"), true);

  try {
    const movimentos = await db(
      supabase
        .from("stock_movimentos")
        .select("quantidade, motivo, criado_em, variante_id")
        .in("variante_id", produto.produto_variantes.map((v) => v.id))
        .order("criado_em", { ascending: false })
        .limit(10),
    );
    const nomeVariante = (id) => produto.produto_variantes.find((v) => v.id === id)?.nome || "";
    $("listaMovimentos").innerHTML = movimentos.length
      ? movimentos
          .map(
            (m) => `
        <li>
          <span class="${m.quantidade > 0 ? "texto-destaque" : "celula-saida"}">${m.quantidade > 0 ? "+" : ""}${e(m.quantidade)}</span>
          <span>${e(nomeVariante(m.variante_id))} · ${e(m.motivo)}</span>
          <small>${e(new Date(m.criado_em).toLocaleDateString("pt-PT"))}</small>
        </li>`,
          )
          .join("")
      : "<li>Sem movimentos registados.</li>";
  } catch (err) {
    $("listaMovimentos").innerHTML = `<li class="celula-erro">${e(mensagemErro(err))}</li>`;
  }
}

async function submeterStock(ev) {
  ev.preventDefault();
  const btn = $("btnGuardarStock");
  if (btn.disabled || !produtoStock) return;
  const quantidade = parseInt($("stockQuantidade").value, 10);
  const tipo = $("stockTipo").value;
  if (!Number.isInteger(quantidade) || quantidade === 0 || (tipo === "Entrada" && quantidade < 0)) {
    return mostrarAviso("Atenção", tipo === "Entrada" ? "Numa entrada a quantidade tem de ser positiva." : ERROS.QUANTIDADE_INVALIDA, "erro");
  }
  btn.disabled = true;
  try {
    const novoStock = await db(
      supabase.rpc("repor_stock", {
        p_variante_id: Number($("stockVariante").value),
        p_quantidade: quantidade,
        p_motivo: tipo,
      }),
    );
    mostrarAviso("Stock atualizado", `Novo stock: ${novoStock}.`, "sucesso");
    mostrar($("modalStock"), false);
    await carregarVendasEStock();
  } catch (err) {
    mostrarAviso("Erro no stock", mensagemErro(err), "erro");
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// RECEBER PAGAMENTO / ANULAR
// ---------------------------------------------------------------------------
function abrirPagar(venda) {
  vendaSelecionada = venda;
  $("pagarVendaResumo").textContent = `${venda.cliente_nome} — ${euros(venda.total)} (${resumoArtigos(venda)})`;
  mostrar($("modalPagarVenda"), true);
}

async function submeterPagar(ev) {
  ev.preventDefault();
  const btn = $("btnConfirmarPagarVenda");
  if (btn.disabled || !vendaSelecionada) return;
  btn.disabled = true;
  try {
    await db(supabase.rpc("marcar_venda_paga", { p_venda_id: vendaSelecionada.id, p_metodo: $("pagarVendaMetodo").value }));
    mostrarAviso("Pagamento recebido", `${vendaSelecionada.cliente_nome}: ${euros(vendaSelecionada.total)}.`, "sucesso");
    mostrar($("modalPagarVenda"), false);
    await carregarVendasEStock();
  } catch (err) {
    mostrarAviso("Erro", mensagemErro(err), "erro");
  } finally {
    btn.disabled = false;
  }
}

function abrirAnular(venda) {
  vendaSelecionada = venda;
  $("anularVendaResumo").textContent = `${venda.cliente_nome} — ${euros(venda.total)}. Os artigos voltam ao stock e a venda fica marcada como anulada.`;
  mostrar($("modalAnularVenda"), true);
}

async function confirmarAnular() {
  const btn = $("btnConfirmarAnularVenda");
  if (btn.disabled || !vendaSelecionada) return;
  btn.disabled = true;
  try {
    await db(supabase.rpc("anular_venda", { p_venda_id: vendaSelecionada.id }));
    mostrarAviso("Venda anulada", "Os artigos voltaram ao stock.", "sucesso");
    mostrar($("modalAnularVenda"), false);
    await carregarVendasEStock();
  } catch (err) {
    mostrarAviso("Erro", mensagemErro(err), "erro");
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// NAVEGAÇÃO E EVENTOS (registados uma única vez)
// ---------------------------------------------------------------------------
function vistaVendasVisivel() {
  return !$("view-vendas")?.classList.contains("hidden");
}

function abrirVistaVendas() {
  document.querySelectorAll(".tab-content").forEach((t) => {
    t.classList.add("hidden");
    t.classList.remove("active");
  });
  document.querySelectorAll(".tab-btn").forEach((t) => t.classList.remove("active"));
  const vista = $("view-vendas");
  vista.classList.remove("hidden");
  vista.classList.add("active");
  carregarVendasEStock();
}

function mostrarPainel(id) {
  document.querySelectorAll(".vendas-subtab").forEach((b) => b.classList.toggle("ativo", b.dataset.painel === id));
  document.querySelectorAll(".vendas-painel").forEach((p) => mostrar(p, p.id === id));
}

export function initVendasEvents() {
  if (!$("view-vendas")) return;

  $("btnAbrirVendas")?.addEventListener("click", abrirVistaVendas);
  $("filtroMesMensalidade")?.addEventListener("change", () => {
    if (vistaVendasVisivel()) carregarVendasEStock();
  });

  document.querySelectorAll(".vendas-subtab").forEach((b) =>
    b.addEventListener("click", () => mostrarPainel(b.dataset.painel)),
  );
  $("cartaoStockBaixo").addEventListener("click", () => {
    $("filtroStockBaixo").checked = true;
    mostrarPainel("painelProdutos");
    renderizarProdutos();
  });

  $("filtroVendas").addEventListener("input", debounce(renderizarVendas, 250));
  $("filtroProdutos").addEventListener("input", debounce(renderizarProdutos, 250));
  ["filtroCategoria", "filtroStockBaixo", "filtroArquivados"].forEach((id) =>
    $(id).addEventListener("change", renderizarProdutos),
  );

  // Tabelas: delegação de eventos (um listener por tabela)
  $("tabelaVendas").addEventListener("click", (ev) => {
    const receber = ev.target.closest(".btn-receber-venda");
    const anular = ev.target.closest(".btn-anular-venda");
    const venda = vendas.find((v) => String(v.id) === (receber || anular)?.dataset.id);
    if (!venda) return;
    if (receber) abrirPagar(venda);
    if (anular) abrirAnular(venda);
  });
  $("tabelaProdutos").addEventListener("click", (ev) => {
    const botao = ev.target.closest("button[data-id]");
    const produto = botao && produtoPorId(botao.dataset.id);
    if (!produto) return;
    if (botao.classList.contains("btn-editar-produto")) abrirProduto(produto);
    if (botao.classList.contains("btn-stock-produto")) abrirStock(produto);
    if (botao.classList.contains("btn-arquivar-produto")) alternarArquivo(produto);
  });

  // Nova venda
  $("btnNovaVenda").addEventListener("click", abrirNovaVenda);
  document.querySelectorAll('input[name="tipoCliente"]').forEach((r) => r.addEventListener("change", alternarTipoCliente));
  $("vendaEstado").addEventListener("change", alternarMetodo);
  $("vendaProduto").addEventListener("change", preencherVariantes);
  $("btnAdicionarArtigo").addEventListener("click", adicionarAoCarrinho);
  $("vendaCarrinho").addEventListener("click", (ev) => {
    const btn = ev.target.closest(".btn-remover-artigo");
    if (!btn) return;
    carrinho.splice(Number(btn.dataset.indice), 1);
    renderizarCarrinho();
    preencherVariantes();
  });
  $("formNovaVenda").addEventListener("submit", submeterVenda);

  // Produto
  $("btnNovoProduto").addEventListener("click", () => abrirProduto());
  $("produtoPrecoCompra").addEventListener("input", atualizarMargem);
  $("produtoPrecoVenda").addEventListener("input", atualizarMargem);
  $("btnAdicionarVariante").addEventListener("click", () => $("listaVariantes").appendChild(linhaVariante()));
  $("listaVariantes").addEventListener("click", (ev) => {
    ev.target.closest(".btn-remover-variante")?.closest(".vendas-variante-linha")?.remove();
  });
  document.querySelectorAll("[data-predefinicao]").forEach((b) =>
    b.addEventListener("click", () => aplicarPredefinicao(b.dataset.predefinicao.split(","))),
  );
  $("formProduto").addEventListener("submit", submeterProduto);

  // Stock, pagamento, anulação
  $("formStock").addEventListener("submit", submeterStock);
  $("formPagarVenda").addEventListener("submit", submeterPagar);
  $("btnConfirmarAnularVenda").addEventListener("click", confirmarAnular);

  // Fechar modais (botão X, cancelar e clique fora)
  const fechos = {
    btnFecharNovaVenda: "modalNovaVenda",
    btnFecharProduto: "modalProduto",
    btnFecharStock: "modalStock",
    btnFecharPagarVenda: "modalPagarVenda",
    btnCancelarAnularVenda: "modalAnularVenda",
  };
  Object.entries(fechos).forEach(([botao, modal]) => {
    $(botao)?.addEventListener("click", () => mostrar($(modal), false));
    $(modal)?.addEventListener("click", (ev) => {
      if (ev.target === $(modal)) mostrar($(modal), false);
    });
  });
}
