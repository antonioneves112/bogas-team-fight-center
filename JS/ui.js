/* JS/ui.js - CONTROLO VISUAL DA INTERFACE */

// Controlar as Tabs (Separadores)
export function inicializarTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((content) => content.classList.add("hidden"));

      btn.classList.add("active");
      document
        .getElementById(btn.getAttribute("data-target"))
        .classList.remove("hidden");
    });
  });
}

// Fechar os Modais (A abertura é tratada nos módulos de dados)
export function inicializarFechoModais() {
  const modalSocio = document.getElementById("modalSocio");
  const modalPagamento = document.getElementById("modalPagamento");

  document.getElementById("btnFecharModal").addEventListener("click", () => {
    modalSocio.classList.add("hidden");
  });

  document
    .getElementById("btnFecharModalPagamento")
    .addEventListener("click", () => {
      modalPagamento.classList.add("hidden");
    });
}
