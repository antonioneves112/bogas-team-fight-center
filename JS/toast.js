/* JS/toast.js - AVISOS VISUAIS (partilhado por dashboard, portal e login) */

const MAX_AVISOS = 2;

// Cria o aviso com textContent: qualquer texto (incluindo mensagens de erro do
// servidor) é mostrado como texto e nunca interpretado como HTML.
export function mostrarAviso(titulo, mensagem, tipo = "sucesso", duracaoMs = 4000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  while (container.children.length >= MAX_AVISOS) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;

  const icone = document.createElement("i");
  icone.className = `bx ${tipo === "sucesso" ? "bx-check-circle" : "bx-error-circle"}`;

  const conteudo = document.createElement("div");
  conteudo.className = "toast-content";
  const h4 = document.createElement("h4");
  h4.textContent = titulo ?? "";
  const p = document.createElement("p");
  p.textContent = mensagem ?? "";
  conteudo.append(h4, p);

  toast.append(icone, conteudo);
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, duracaoMs);
}
