/* JS/registar-sw.js - Regista o Service Worker (PWA). Partilhado por todas as páginas da app. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.error("Erro no PWA:", err));
  });
}
