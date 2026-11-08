/* JS/congelamentos.js - CONGELAR SÓCIOS (lesão, férias, pausa)
 *
 * Congela-se por meses inteiros (mes_inicio..mes_fim, 'YYYY-MM').
 * Nesses meses o sócio não deve mensalidade; volta a pagar sozinho no mês seguinte.
 * A BD recusa congelamentos sobrepostos (05_congelamentos.sql).
 */
import { supabase, db } from "./supabase.js";
import { state } from "./state.js";
import { MESES_PT, mesLocalISO, escapeHTML, mostrar } from "./helpers.js";
import { mostrarAviso } from "./toast.js";
import { carregarGuerreiros } from "./socios.js";

const $ = (id) => document.getElementById(id);
let socioAtual = null;

const nomeMes = (mes) => {
  const [ano, m] = mes.split("-");
  return `${MESES_PT[Number(m) - 1]} ${ano}`;
};

function somarMeses(mes, n) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function atualizarRegresso() {
  const inicio = $("congelarInicio").value;
  const fim = $("congelarFim").value;
  const el = $("congelarRegresso");
  if (!inicio || !fim) {
    el.textContent = "";
    return;
  }
  if (fim < inicio) {
    el.textContent = "O último mês tem de ser igual ou depois do primeiro.";
    el.classList.add("congelar-erro");
    return;
  }
  el.classList.remove("congelar-erro");
  const meses = (Number(fim.slice(0, 4)) - Number(inicio.slice(0, 4))) * 12 + Number(fim.slice(5)) - Number(inicio.slice(5)) + 1;
  el.textContent = `${meses} ${meses === 1 ? "mês congelado" : "meses congelados"} · volta a pagar em ${nomeMes(somarMeses(fim, 1))}.`;
}

async function carregarLista() {
  const lista = $("listaCongelamentos");
  lista.innerHTML = "<li class='congelar-vazio'>A carregar...</li>";
  try {
    const linhas = await db(
      supabase
        .from("socio_congelamentos")
        .select("id, mes_inicio, mes_fim, motivo, notas")
        .eq("socio_id", socioAtual.id)
        .order("mes_inicio", { ascending: false })
        .limit(10),
    );
    if (!linhas.length) {
      lista.innerHTML = "<li class='congelar-vazio'>Nunca foi congelado.</li>";
      return;
    }
    const mesHoje = mesLocalISO();
    lista.innerHTML = linhas
      .map((c) => {
        let estado = "Terminado";
        let acao = "";
        if (c.mes_inicio > mesHoje) {
          estado = "Agendado";
          acao = `<button type="button" class="btn-acao btn-delete btn-cancelar-congelamento" data-id="${escapeHTML(c.id)}" title="Cancelar este congelamento"><i class='bx bx-x'></i></button>`;
        } else if (c.mes_inicio === mesHoje) {
          estado = "Congelado agora";
          acao = `<button type="button" class="btn-acao btn-delete btn-cancelar-congelamento" data-id="${escapeHTML(c.id)}" title="Cancelar (começava este mês)"><i class='bx bx-x'></i></button>`;
        } else if (c.mes_fim >= mesHoje) {
          estado = "Congelado agora";
          acao = `<button type="button" class="btn-tatico btn-small btn-terminar-congelamento" data-id="${escapeHTML(c.id)}" title="Volta a pagar já este mês">Terminar</button>`;
        }
        const periodo = c.mes_inicio === c.mes_fim ? nomeMes(c.mes_inicio) : `${nomeMes(c.mes_inicio)} – ${nomeMes(c.mes_fim)}`;
        return `
        <li class="congelar-item">
          <div>
            <strong>${escapeHTML(periodo)}</strong>
            <span class="congelar-meta">${escapeHTML(c.motivo)} · ${escapeHTML(estado)}${c.notas ? ` · ${escapeHTML(c.notas)}` : ""}</span>
          </div>
          ${acao}
        </li>`;
      })
      .join("");
  } catch (err) {
    const falta = /does not exist|Could not find|PGRST205|42P01/.test(`${err.message} ${err.code}`);
    lista.innerHTML = `<li class="celula-erro">${escapeHTML(falta ? "O congelamento ainda não está ativo na base de dados (falta correr 05_congelamentos.sql)." : err.message)}</li>`;
  }
}

export function abrirModalCongelar(socio) {
  socioAtual = socio;
  $("formCongelar").reset();
  $("congelarNome").textContent = socio.nome;
  const mes = $("filtroMesMensalidade")?.value || mesLocalISO();
  const inicio = mes < mesLocalISO() ? mesLocalISO() : mes;
  $("congelarInicio").value = inicio;
  $("congelarFim").value = inicio;
  atualizarRegresso();
  mostrar($("modalCongelar"), true);
  carregarLista();
}

async function guardar(ev) {
  ev.preventDefault();
  const btn = $("btnGuardarCongelar");
  if (btn.disabled || !socioAtual) return;
  const inicio = $("congelarInicio").value;
  const fim = $("congelarFim").value;
  if (!inicio || !fim || fim < inicio) {
    mostrarAviso("Atenção", "O último mês tem de ser igual ou depois do primeiro.", "erro");
    return;
  }
  btn.disabled = true;
  try {
    await db(
      supabase.from("socio_congelamentos").insert([
        {
          socio_id: socioAtual.id,
          mes_inicio: inicio,
          mes_fim: fim,
          motivo: $("congelarMotivo").value,
          notas: $("congelarNotas").value.trim() || null,
          treinador: state.treinadorAtual || null,
        },
      ]),
    );
    mostrarAviso("Sócio congelado", `${socioAtual.nome}: volta a pagar em ${nomeMes(somarMeses(fim, 1))}.`, "sucesso");
    $("formCongelar").reset();
    await carregarLista();
    carregarGuerreiros();
  } catch (err) {
    mostrarAviso(
      "Não foi possível congelar",
      err.message?.includes("CONGELAMENTO_SOBREPOSTO")
        ? "Já existe um congelamento nesses meses. Termina ou cancela o anterior primeiro."
        : err.message,
      "erro",
    );
  } finally {
    btn.disabled = false;
  }
}

async function acaoNaLista(ev) {
  const cancelar = ev.target.closest(".btn-cancelar-congelamento");
  const terminar = ev.target.closest(".btn-terminar-congelamento");
  const btn = cancelar || terminar;
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  try {
    if (cancelar) {
      await db(supabase.from("socio_congelamentos").delete().eq("id", Number(btn.dataset.id)));
      mostrarAviso("Congelamento cancelado", `${socioAtual.nome} volta ao normal.`, "sucesso");
    } else {
      // Terminar: o último mês congelado passa a ser o anterior; este mês já é pago.
      const mesAnterior = somarMeses(mesLocalISO(), -1);
      await db(supabase.from("socio_congelamentos").update({ mes_fim: mesAnterior }).eq("id", Number(btn.dataset.id)));
      mostrarAviso("Congelamento terminado", `${socioAtual.nome} volta a pagar a partir deste mês.`, "sucesso");
    }
    await carregarLista();
    carregarGuerreiros();
  } catch (err) {
    mostrarAviso("Erro", err.message, "erro");
    btn.disabled = false;
  }
}

export function initCongelamentosEvents() {
  if (!$("modalCongelar")) return;
  $("btnFecharCongelar").addEventListener("click", () => mostrar($("modalCongelar"), false));
  $("modalCongelar").addEventListener("click", (ev) => {
    if (ev.target === $("modalCongelar")) mostrar($("modalCongelar"), false);
  });
  $("congelarInicio").addEventListener("input", () => {
    if ($("congelarFim").value < $("congelarInicio").value) $("congelarFim").value = $("congelarInicio").value;
    atualizarRegresso();
  });
  $("congelarFim").addEventListener("input", atualizarRegresso);
  $("formCongelar").addEventListener("submit", guardar);
  $("listaCongelamentos").addEventListener("click", acaoNaLista);
}
