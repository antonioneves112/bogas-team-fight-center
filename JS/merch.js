/* =========================================================
   JS/merch.js - MASTER E-COMMERCE LOGIC
   (Inicia 100% vazio: Sem botões ativos, sem produtos visíveis)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const PHONE = "351911933140";

  const grid = qs("#merchGrid");
  const cards = qsa(".product-card.js-product");
  const filterBtns = qsa(".js-filter");
  const emptyEl = qs("#filterEmpty");
  const searchInput = qs("#searchInput");
  const sortSelect = qs("#sortSelect");
  const toolsEl = qs("#merchTools");

  const modal = qs("#size-modal");
  const closeBtn = qs("#modal-close", modal);
  const confirmBtn = qs("#confirm-size", modal);
  const titleEl = qs("#modal-product-name", modal);
  const priceEl = qs("#modal-product-price", modal);
  const sizeOptionsEl = qs("#modal-size-options", modal);

  if (!grid || !cards.length) return;

  const state = {
    filter: "none",
    query: "",
    sort: "price-asc",
    currentProduct: null,
    selectedSize: "",
    hasInteracted: false,
  };

  cards.forEach((card, i) => (card.dataset.origIndex = String(i)));

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function parsePrice(card) {
    let priceStr =
      card.dataset.price ||
      card.querySelector(".product-price")?.textContent ||
      "0";
    let cleanStr = priceStr
      .replace("€", "")
      .replace(/\s/g, "")
      .replace(",", ".");
    let n = parseFloat(cleanStr);
    return Number.isFinite(n) ? n : 0;
  }

  function showEmpty(show) {
    if (!emptyEl) return;
    if (state.filter === "none" && state.query === "") {
      emptyEl.classList.add("is-hidden");
    } else {
      emptyEl.classList.toggle("is-hidden", !show);
    }
  }

  qsa(".product-card img").forEach((img) => {
    const markLoaded = () => img.classList.add("loaded");
    if (img.complete && img.naturalHeight !== 0) markLoaded();
    else {
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markLoaded, { once: true });
    }
  });

  function badgeLabel(type) {
    if (type === "mais-vendido") return "Mais vendido";
    if (type === "novo") return "Novo";
    if (type === "esgotado") return "Esgotado";
    return "";
  }

  function badgeClass(type) {
    if (type === "mais-vendido") return "is-best";
    if (type === "novo") return "is-new";
    if (type === "esgotado") return "is-soldout";
    return "";
  }

  function resolveBadgeType(card) {
    const stock = (card.dataset.stock || "").toLowerCase().trim();
    if (stock === "out") return "esgotado";
    const b = (card.dataset.badge || "").toLowerCase().trim();
    if (!b) return "";
    if (b === "maisvendido") return "mais-vendido";
    return b;
  }

  function applyBadgesAndStock() {
    cards.forEach((card) => {
      const type = resolveBadgeType(card);
      const existing = card.querySelector(".product-badge");
      if (existing) existing.remove();

      const isSoldOut = type === "esgotado";
      card.classList.toggle("is-soldout", isSoldOut);

      if (isSoldOut) {
        card.disabled = true;
        card.setAttribute("aria-disabled", "true");
        const cta = card.querySelector(".product-cta");
        if (cta) cta.textContent = "Esgotado";
      } else {
        card.disabled = false;
        card.removeAttribute("aria-disabled");
        const cta = card.querySelector(".product-cta");
        if (cta) cta.textContent = "Encomendar";
      }

      if (!type) return;

      const span = document.createElement("span");
      span.className = `product-badge ${badgeClass(type)}`.trim();
      span.textContent = badgeLabel(type);
      card.prepend(span);
    });
  }

  applyBadgesAndStock();

  function setActiveFilterBtn(filter) {
    filterBtns.forEach((b) => {
      const active =
        state.hasInteracted && (b.dataset.filter || "all") === filter;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  function getVisibleCards() {
    const f = state.filter;
    const q = normalize(state.query);

    if (f === "none" && q === "") return [];

    return cards.filter((card) => {
      const cat = (card.dataset.category || "").toLowerCase();
      const name = normalize(
        card.dataset.product ||
          card.querySelector(".product-name")?.textContent,
      );

      const passFilter = f === "all" ? true : cat === f;
      const passSearch = q ? name.includes(q) : true;

      return passFilter && passSearch;
    });
  }

  function sortCards(list) {
    const mode = state.sort;

    return list.sort((a, b) => {
      const aSoldOut = a.classList.contains("is-soldout") ? 1 : 0;
      const bSoldOut = b.classList.contains("is-soldout") ? 1 : 0;

      if (aSoldOut !== bSoldOut) {
        return aSoldOut - bSoldOut;
      }

      if (mode === "price-asc" || mode === "price-desc") {
        const ap = parsePrice(a);
        const bp = parsePrice(b);
        if (ap !== bp) {
          return mode === "price-asc" ? ap - bp : bp - ap;
        }
      }

      if (mode === "name-asc" || parsePrice(a) === parsePrice(b)) {
        return normalize(a.dataset.product || "").localeCompare(
          normalize(b.dataset.product || ""),
          "pt",
        );
      }

      return 0;
    });
  }

  function render() {
    if (toolsEl) {
      if (!state.hasInteracted) {
        toolsEl.style.display = "none";
      } else {
        toolsEl.style.display = window.innerWidth <= 768 ? "flex" : "grid";
      }
    }

    const visibleCards = getVisibleCards();

    cards.forEach((c) => {
      c.classList.add("is-hidden");
      c.style.display = "none";
    });

    if (visibleCards.length === 0) {
      showEmpty(true);
      return;
    }

    const sortedVisible = sortCards(visibleCards);
    const frag = document.createDocumentFragment();

    sortedVisible.forEach((c) => {
      c.classList.remove("is-hidden");
      c.style.display = "flex";
      frag.appendChild(c);
    });

    const hiddenCards = cards.filter((c) => c.classList.contains("is-hidden"));
    hiddenCards.forEach((c) => frag.appendChild(c));

    grid.appendChild(frag);
    showEmpty(false);
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.hasInteracted = true;
      state.filter = (btn.dataset.filter || "all").toLowerCase();
      setActiveFilterBtn(state.filter);
      render();
    });
  });

  let t = null;
  searchInput?.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = searchInput.value || "";
      if (state.query !== "" && state.filter === "none") {
        state.filter = "all";
        setActiveFilterBtn("all");
      }
      render();
    }, 140);
  });

  sortSelect?.addEventListener("change", () => {
    state.sort = sortSelect.value || "price-asc";
    render();
  });

  window.addEventListener("resize", () => {
    if (toolsEl && toolsEl.style.display !== "none") {
      toolsEl.style.display = window.innerWidth <= 768 ? "flex" : "grid";
    }
  });

  if (sortSelect) sortSelect.value = state.sort;
  setActiveFilterBtn(state.filter);
  render();

  // -------------------------
  // LÓGICA DO MODAL WHATSAPP
  // -------------------------
  function openWhatsApp({ name, price, size }) {
    const parts = [
      "Gostaria de encomendar o seguinte artigo:",
      `${name}${price ? ` (${price})` : ""}`,
      size ? `Tamanho: ${size}` : "",
    ].filter(Boolean);

    const message = parts.join("\n");
    const url = `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  function resetSizes() {
    state.selectedSize = "";
    sizeOptionsEl.innerHTML = "";
  }

  function buildSizesList(sizes) {
    sizeOptionsEl.innerHTML = "";

    sizes.forEach((sz) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tactic-opt"; // Usa a classe do component global theme.css
      btn.textContent = sz;
      btn.dataset.value = sz;

      btn.addEventListener("click", () => {
        qsa(".tactic-opt", sizeOptionsEl).forEach((b) =>
          b.classList.remove("is-selected"),
        );

        btn.classList.add("is-selected");
        state.selectedSize = sz;

        confirmBtn.innerHTML = 'Encomendar <i class="bx bxl-whatsapp"></i>';
        confirmBtn.disabled = false;
      });

      sizeOptionsEl.appendChild(btn);
    });
  }

  function openModal(product) {
    state.currentProduct = product;
    modal.classList.remove("is-hidden"); // Usamos a classe global
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");

    titleEl.textContent = product.name || "Produto";
    priceEl.textContent = product.price ? `Preço: ${product.price}` : "";

    confirmBtn.textContent = "Selecionar Tamanho";
    confirmBtn.disabled = true;

    resetSizes();
    buildSizesList(product.sizes);
    closeBtn?.focus?.();
  }

  function closeModal() {
    modal.classList.add("is-hidden"); // Usamos a classe global
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    state.currentProduct = null;
    resetSizes();
  }

  // Se clicar fora do painel de vidro, fecha o modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  closeBtn.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("is-hidden"))
      closeModal();
  });

  confirmBtn.addEventListener("click", () => {
    if (!state.currentProduct || !state.selectedSize) return;
    openWhatsApp({
      name: state.currentProduct.name,
      price: state.currentProduct.price,
      size: state.selectedSize,
    });
    closeModal();
  });

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      if (card.disabled) return;
      const name =
        card.dataset.product ||
        card.querySelector(".product-name")?.textContent ||
        "Produto";
      const price =
        card.dataset.price ||
        card.querySelector(".product-price")?.textContent ||
        "";
      const sizesRaw = (card.dataset.sizes || "").trim();
      const sizes = sizesRaw
        ? sizesRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (sizes.length) {
        openModal({ name, price, sizes });
      } else {
        openWhatsApp({ name, price, size: "" });
      }
    });
  });
});
