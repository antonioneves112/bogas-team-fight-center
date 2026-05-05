/* JS/app-routing.js - Controla a navegação exclusiva quando a PWA está aberta */

document.addEventListener("DOMContentLoaded", () => {
  // 1. O Sensor: Verifica se o utilizador está na App instalada
  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (estaNaApp) {
    // 🥊 DEFESA 1: Se já estamos no Gateway, tranca a porta para não voltar ao site público
    if (window.location.pathname.includes("gateway.html")) {
      window.history.pushState(null, null, window.location.href);
      window.addEventListener("popstate", function () {
        window.history.pushState(null, null, window.location.href);
      });
    }

    // 2. Apanha todos os links da página
    const links = document.querySelectorAll("a");

    links.forEach((link) => {
      const href = link.getAttribute("href") || "";
      const texto = link.textContent.trim().toLowerCase();

      // 🥊 ALVO 1: TERMINAR SESSÃO / LOGOUT
      if (
        texto.includes("terminar") ||
        texto.includes("sair") ||
        texto.includes("logout")
      ) {
        // DEFESA 2: Interceta o clique e APAGA o histórico em vez de apenas seguir o link
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const destino = href.includes("../")
            ? "../gateway.html"
            : "./gateway.html";
          window.location.replace(destino); // O "replace" esmaga a página anterior do histórico!
        });
      }
      // 🥊 ALVO 2: VOLTAR ATRÁS / IR PARA A HOME
      else if (texto.includes("voltar") || href.includes("index.html")) {
        // Muda o texto e o ícone para fazer sentido dentro da App
        link.innerHTML = "<i class='bx bx-left-arrow-alt'></i> VOLTAR ATRÁS";

        if (href.includes("../")) {
          link.href = "../gateway.html";
        } else {
          link.href = "./gateway.html";
        }
      }
    });
  }
});
