/* JS/horarios.js - Proteção Tática de Contactos Ativada */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  const container = qs("#days-container");
  const selectedInfo = qs("#selectedInfo");
  const filterBtns = qsa(".js-filter");
  const countEl = qs("#filterCount");
  const emptyEl = qs("#scheduleEmpty");

  const cta = qs("#scheduleCta");
  const ctaBtn = qs("#scheduleCtaBtn");
  const backBtn = qs("#backToSchedule");
  const journeySection = qs("#journeySection");

  if (!container) return;

  // --- PROTEÇÃO DE DADOS (Camuflagem de Números) ---
  const prefix = "351";
  const numA = "914";
  const numB = "367";
  const numC = "087";
  const numD = "911";
  const numE = "933";
  const numF = "140";

  const WA_BY_COACH = {
    "Francisco António": prefix + numA + numB + numC,
    "José 'Bogas' Oliveira": prefix + numA + numB + numC,
    "António Neves": prefix + numD + numE + numF,
  };

  const WA_FALLBACK = prefix + numA + numB + numC;
  // ------------------------------------------------

  const DATA = [
    {
      day: "Segunda-feira",
      classes: [
        { modality: "Boxe", time: "18:00 - 19:00", coach: "Francisco António" },
        {
          modality: "Kickboxing",
          turma: "Turma A",
          time: "19:15 - 20:30",
          coach: "José 'Bogas' Oliveira",
        },
        {
          modality: "Kickboxing",
          turma: "Turma B",
          time: "20:40 - 21:50",
          coach: "António Neves",
        },
      ],
    },
    {
      day: "Quarta-feira",
      classes: [
        { modality: "Boxe", time: "18:00 - 19:00", coach: "Francisco António" },
        {
          modality: "Kickboxing",
          turma: "Turma A",
          time: "19:15 - 20:30",
          coach: "José 'Bogas' Oliveira",
        },
        {
          modality: "Kickboxing",
          turma: "Turma B",
          time: "20:40 - 21:50",
          coach: "António Neves",
        },
      ],
    },
    {
      day: "Sexta-feira",
      classes: [
        { modality: "Boxe", time: "18:00 - 19:00", coach: "Francisco António" },
        {
          modality: "Kickboxing",
          turma: "Turma A",
          time: "19:15 - 20:30",
          coach: "José 'Bogas' Oliveira",
        },
        {
          modality: "Kickboxing",
          turma: "Turma B",
          time: "20:40 - 21:50",
          coach: "António Neves",
        },
      ],
    },
  ];

  const state = { filter: null, selected: null };

  /* =========================================================
     SENSOR DE FOCO NO SCROLL (MOBILE) - RECUPERADO
  ========================================================= */
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      if (window.innerWidth > 768) return;

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-scroll-focus");
        } else {
          entry.target.classList.remove("is-scroll-focus");
        }
      });
    },
    {
      /* Define a margem para ativar exatamente quando chega ao meio do ecrã */
      rootMargin: "-30% 0px -30% 0px",
      threshold: 0.5,
    },
  );

  function refreshScrollObserver() {
    // 2. Aplica o sensor aos Cartões da Jornada
    qsa(".journey-grid .card").forEach((card) => scrollObserver.observe(card));
  }

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function formatSelected(sel) {
    if (!sel) return "";

    const turma = sel.turma ? `${sel.turma} ` : "";

    return `
      <span class="sel-day">${sel.day}</span>
      <span class="sel-mod">${sel.modality}</span>
      <span class="sel-details">${turma}(${sel.time})</span>
    `;
  }

  function setSelectedText() {
    if (!selectedInfo) return;
    selectedInfo.innerHTML = formatSelected(state.selected);
  }

  function setCount(n) {
    if (!countEl) return;
    countEl.textContent =
      n === 1 ? "1 aula disponível" : `${n} aulas disponíveis`;
  }

  function showEmpty(show, text) {
    if (!emptyEl) return;
    if (text) emptyEl.textContent = text;
    emptyEl.classList.toggle("is-hidden", !show);
  }

  function setActiveFilterBtn(filter) {
    filterBtns.forEach((b) => {
      const active = (b.dataset.filter || "all") === filter;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  }

  function initCta() {
    if (!cta || !ctaBtn) return;
    ctaBtn.disabled = true;
    cta.classList.remove("is-enabled");
  }

  function enableCta() {
    if (!cta || !ctaBtn) return;
    ctaBtn.disabled = false;
    cta.classList.add("is-enabled");
  }

  function disableCta() {
    if (!cta || !ctaBtn) return;
    ctaBtn.disabled = true;
    cta.classList.remove("is-enabled");
  }

  function clearSelection() {
    qsa(".class.is-selected", container).forEach((c) => {
      c.classList.remove("is-selected");
      c.setAttribute("aria-pressed", "false");
    });
    state.selected = null;
    if (selectedInfo) selectedInfo.innerHTML = "";
    disableCta();
  }

  function makeClassCard(c, dayLabel) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "class";
    btn.dataset.modality = normalize(c.modality);
    btn.dataset.dayLabel = dayLabel;

    const mod = document.createElement("div");
    mod.className = "modalidade";
    mod.innerText = c.modality;
    if (c.turma) {
      const t = document.createElement("span");
      t.className = "turma";
      t.textContent = c.turma;
      mod.appendChild(t);
    }

    const time = document.createElement("div");
    time.className = "horario";
    time.textContent = c.time;

    const coach = document.createElement("div");
    coach.className = "treinador";
    coach.textContent = c.coach || "";

    btn.append(mod, time, coach);

    btn.addEventListener("click", () => {
      const already = btn.classList.contains("is-selected");
      clearSelection();

      if (!already) {
        btn.classList.add("is-selected");
        state.selected = { ...c, day: dayLabel };
        setSelectedText();
        enableCta();

        if (container) container.classList.add("is-hidden");
        if (journeySection) journeySection.classList.remove("is-hidden");

        setTimeout(() => {
          if (journeySection) {
            journeySection.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 150);
      }
    });

    return btn;
  }

  function buildDayCard(dayObj) {
    const day = document.createElement("section");
    day.className = "card day";
    const title = document.createElement("h2");
    title.className = "day-title";
    title.textContent = dayObj.day;
    const list = document.createElement("div");
    list.className = "classes";
    dayObj.classes.forEach((c) =>
      list.appendChild(makeClassCard(c, dayObj.day)),
    );
    day.append(title, list);
    return day;
  }

  function renderBase() {
    container.innerHTML = "";
    DATA.forEach((d) => container.appendChild(buildDayCard(d)));
    refreshScrollObserver(); // Re-liga o sensor ao desenhar
  }

  function applyFilter() {
    container.classList.remove("is-hidden");
    const filter = state.filter;
    const allClasses = qsa(".class", container);
    allClasses.forEach((btn) => {
      const mod = btn.dataset.modality || "";
      const visible = filter === "all" ? true : mod === filter;
      btn.classList.toggle("is-hidden", !visible);
    });

    const days = qsa(".day", container);
    days.forEach((day) => {
      const visibleClasses = qsa(".class:not(.is-hidden)", day);
      day.classList.toggle("is-hidden", visibleClasses.length === 0);
    });

    const count = qsa(".class:not(.is-hidden)", container).length;
    setCount(count);
    showEmpty(count === 0, count === 0 ? "Sem resultados." : null);
    refreshScrollObserver(); // Re-liga o sensor ao filtrar
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = (btn.dataset.filter || "all").toLowerCase();
      setActiveFilterBtn(state.filter);

      if (journeySection) journeySection.classList.add("is-hidden");
      clearSelection();

      applyFilter();
    });
  });

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      clearSelection();
      if (journeySection) journeySection.classList.add("is-hidden");
      if (container) container.classList.remove("is-hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (ctaBtn) {
    ctaBtn.addEventListener("click", () => {
      if (!state.selected) return;
      const { coach, day, modality, time, turma } = state.selected;
      const phone = WA_BY_COACH[coach] || WA_FALLBACK;
      const text = `Olá! Gostaria de marcar uma aula experimental:\nDia: ${day}\nModalidade: ${modality} ${turma || ""}\nHorário: ${time}`;
      window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    });
  }

  renderBase();
  initCta();
});
