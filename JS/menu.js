// =========================================================================
// MENU DO SITE PÚBLICO: FONTE ÚNICA
// Cada página só tem <header class="site-header"></header> + o overlay, e carrega
// este ficheiro SEM defer logo a seguir. O menu é desenhado de imediato (antes da
// primeira pintura), por isso não "salta". Para mudar o menu em todas as páginas,
// muda só a lista MENU abaixo.
// <header class="site-header" data-instalar> mostra o botão "Instalar App" (só a home).
// =========================================================================
(() => {
  "use strict";

  const MENU = [
    { href: "./index.html", texto: "Home" },
    { href: "./espaco.html", texto: "Espaço" },
    { href: "./equipa.html", texto: "Staff" },
    { href: "./horarios.html", texto: "Horários" },
    { texto: "Eventos", filhos: [{ href: "./graduacoes.html", texto: "Graduações" }] },
    { href: "./merchandising.html", texto: "Store" },
    { href: "./patrocinadores.html", texto: "Patrocinadores" },
    { href: "./contactos.html", texto: "Contactos" },
  ];

  const AREA_TECNICA = [
    { href: "./login.html", texto: "Treinador", icone: "bx-user-circle" },
    { href: "./portal.html", texto: "Sócios", icone: "bx-group" },
  ];

  const header = document.querySelector("header.site-header");
  if (!header || header.children.length) return; // páginas sem menu público (ex.: gateway)

  const ficheiro = (href) => href.split("/").pop().split("#")[0] || "index.html";
  const paginaAtual = ficheiro(location.pathname);
  const ehAtual = (href) => ficheiro(href) === paginaAtual;

  const link = ({ href, texto, icone }, extra = "") => {
    const atual = ehAtual(href) ? ' class="active" aria-current="page"' : "";
    const ic = icone ? `<i class="bx ${icone}" aria-hidden="true"></i> ` : "";
    return `<a href="${href}"${atual}${extra}>${ic}${texto}</a>`;
  };

  const dropdown = (rotulo, filhos, classes = "", classesBotao = "") => {
    const ativo = filhos.some((f) => ehAtual(f.href)) ? " is-active" : "";
    return `
      <div class="dropdown${classes}${ativo}">
        <button class="dropdown-trigger${classesBotao}" type="button" aria-haspopup="true" aria-expanded="false">
          ${rotulo} <i class="bx bx-chevron-down" aria-hidden="true"></i>
        </button>
        <div class="dropdown-menu">${filhos.map((f) => link(f)).join("")}</div>
      </div>`;
  };

  const instalar = header.hasAttribute("data-instalar")
    ? `<button id="btnInstalarApp" class="nav-btn-instalar" type="button">
         <i class="bx bx-download bx-tada" aria-hidden="true"></i> Instalar App
       </button>`
    : "";

  const itens = MENU.map((item) => (item.filhos ? dropdown(item.texto, item.filhos) : link(item))).join("");
  const areaTecnica = dropdown(
    '<i class="bx bx-lock-alt" aria-hidden="true"></i> Área Técnica',
    AREA_TECNICA,
    " item-app-only",
    " nav-login-btn nav-login-btn-reset",
  );

  header.innerHTML = `
    <a href="./index.html" class="site-logo" aria-label="Bogas Team Fight Center — Página inicial">Bogas Team Fight Center</a>
    <button class="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="site-nav">
      <i class="bx bx-menu" aria-hidden="true"></i>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Navegação principal">${instalar}${itens}${areaTecnica}</nav>`;
})();

const estaNaApp = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

// =========================================================================
// ABRIR / FECHAR O MENU (MOBILE) E DROPDOWNS
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const BP = 860;
  const isMobile = () => window.matchMedia(`(max-width:${BP}px)`).matches;

  const body = document.body;
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.getElementById("site-nav");
  const overlay = document.querySelector(".site-nav-overlay");
  if (!toggle || !nav || !overlay) return;

  const dropdowns = Array.from(nav.querySelectorAll(".dropdown"));
  let lastOpener = null;

  function fecharDropdowns(exceto = null) {
    dropdowns.forEach((d) => {
      if (d === exceto) return;
      d.classList.remove("is-open");
      d.querySelector(".dropdown-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  function openNav(opener = null) {
    lastOpener = opener || document.activeElement || null;
    body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    if (isMobile()) {
      const primeiro = nav.querySelector("a, button");
      window.setTimeout(() => primeiro?.focus(), 0);
    }
  }

  function closeNav() {
    body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    fecharDropdowns();
    lastOpener?.focus?.();
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    body.classList.contains("nav-open") ? closeNav() : openNav(toggle);
  });

  overlay.addEventListener("click", closeNav);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeNav();
  });

  // Um só listener: dropdowns, links e clique fora.
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".dropdown-trigger");
    if (trigger && nav.contains(trigger)) {
      if (!isMobile()) return;
      e.preventDefault();
      const pai = trigger.closest(".dropdown");
      fecharDropdowns(pai);
      const aberto = pai.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", String(aberto));
      return;
    }

    if (!isMobile()) return;
    if (e.target.closest("a") && nav.contains(e.target)) {
      closeNav();
      return;
    }
    fecharDropdowns();
    if (body.classList.contains("nav-open") && !nav.contains(e.target) && !toggle.contains(e.target)) {
      closeNav();
    }
  });
});

// =========================================================================
// APP INSTALADA: MOSTRA SÓ A ÁREA TÉCNICA
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const nav = document.getElementById("site-nav");
  if (!nav || !estaNaApp()) return;

  document.body.classList.add("is-app");
  nav.querySelectorAll("a").forEach((a) => {
    if (!a.closest(".item-app-only")) a.classList.add("hidden");
  });
});

// =========================================================================
// VERSÃO DA APP (APENAS DENTRO DA APP INSTALADA)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  if (!estaNaApp()) return;

  let versionEl = document.getElementById("app-version-top");
  if (!versionEl) {
    const nav = document.getElementById("site-nav");
    if (!nav) return;
    versionEl = document.createElement("div");
    versionEl.id = "app-version-display";
    versionEl.className = "app-versao";
    nav.appendChild(versionEl);
  }

  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.tipo === "RESPOSTA_VERSAO") {
      versionEl.textContent = `APP: ${event.data.versao}`;
    }
  });
  navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage({ tipo: "PEDIR_VERSAO" });
  });
});
