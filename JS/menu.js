document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const body = document.body;
  const toggle = qs(".menu-toggle");
  const nav = qs("#site-nav") || qs(".site-nav");
  if (nav && !nav.id) nav.id = "site-nav";
  if (toggle && !toggle.getAttribute("aria-controls")) {
    toggle.setAttribute("aria-controls", "site-nav");
  }
  const overlay = qs(".site-nav-overlay");

  if (!toggle || !nav || !overlay) return;

  const BP = 860;
  const isMobile = () => window.matchMedia(`(max-width:${BP}px)`).matches;

  const dropdown = qs(".dropdown", nav);
  const dropdownTrigger = dropdown ? qs(".dropdown-trigger", dropdown) : null;

  let lastOpener = null;

  function openNav(opener = null) {
    lastOpener = opener || document.activeElement || null;
    body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");

    if (isMobile()) {
      const firstFocusable = qs("a, button", nav);
      window.setTimeout(() => firstFocusable?.focus(), 0);
    }
  }

  function closeNav() {
    body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");

    // fecha dropdown (mobile)
    if (dropdown) dropdown.classList.remove("is-open");
    dropdownTrigger?.setAttribute("aria-expanded", "false");

    if (lastOpener && typeof lastOpener.focus === "function") {
      lastOpener.focus();
    }
  }

  function toggleNav() {
    body.classList.contains("nav-open") ? closeNav() : openNav(toggle);
  }

  // ABRIR/FECHAR menu
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNav();
  });

  overlay.addEventListener("click", closeNav);

  // Click fora fecha (mobile)
  document.addEventListener("click", (e) => {
    if (!isMobile()) return;
    if (!body.classList.contains("nav-open")) return;

    const target = e.target;
    if (nav.contains(target) || toggle.contains(target)) return;
    closeNav();
  });

  // ESC fecha menu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  // Clicar num link fecha em mobile
  qsa("a", nav).forEach((a) => {
    a.addEventListener("click", () => {
      if (isMobile()) closeNav();
    });
  });
});

// =========================================================================
// 🥊 LÓGICA DE DROPDOWNS (MOBILE) - GERE EVENTOS E ÁREA TÉCNICA
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const dropdowns = document.querySelectorAll(".dropdown");

  dropdowns.forEach((dropdown) => {
    const trigger = dropdown.querySelector(".dropdown-trigger");

    if (trigger) {
      trigger.addEventListener("click", function (e) {
        if (window.innerWidth <= 860) {
          e.preventDefault();
          e.stopPropagation();

          const parent = this.closest(".dropdown");

          // Fecha os outros dropdowns abertos para não amontoar
          dropdowns.forEach((d) => {
            if (d !== parent) d.classList.remove("is-open");
          });

          // Abre ou fecha o atual
          parent.classList.toggle("is-open");
        }
      });
    }
  });

  // Clique fora de qualquer dropdown fecha-os todos
  document.addEventListener("click", () => {
    if (window.innerWidth <= 860) {
      dropdowns.forEach((d) => d.classList.remove("is-open"));
    }
  });
});

// =========================================================================
// 🥊 ISOLAMENTO TÁTICO DA APP (MOSTRAR APENAS ÁREA TÉCNICA)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("site-nav");
  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (nav && estaNaApp) {
    document.body.classList.add("is-app");

    const linksPublicos = nav.querySelectorAll("a:not(.nav-login-btn a)");
    linksPublicos.forEach((link) => {
      if (!link.closest(".item-app-only")) {
        link.style.display = "none";
      }
    });
  }
});

// =========================================================================
// 🥊 INJEÇÃO DINÂMICA DA VERSÃO (APENAS DENTRO DA APP INSTALADA)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  if (estaNaApp) {
    const topDisplay = document.getElementById("app-version-top");
    const nav = document.getElementById("site-nav");

    let targetEl = topDisplay || nav;
    if (!targetEl) return;

    let versionEl = topDisplay;
    if (!versionEl) {
      versionEl = document.createElement("div");
      versionEl.id = "app-version-display";
      versionEl.style.cssText =
        "text-align: center; font-size: 0.65rem; color: rgba(255,255,255,0.3); margin-top: auto; padding-top: 20px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px;";
      nav.appendChild(versionEl);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.tipo === "RESPOSTA_VERSAO") {
          versionEl.innerText = `APP: ${event.data.versao}`;
        }
      });

      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          registration.active.postMessage({ tipo: "PEDIR_VERSAO" });
        }
      });
    }
  }
});
