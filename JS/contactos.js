/* ==================================================
   JS/contactos.js - Lógica Dinâmica e Protegida (Anti-Bot)
   ================================================== */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // 1. MONTAR O NÚMERO VISÍVEL DE FORMA SEGURA
  const telContainer = document.getElementById("obf-tel");
  const p1 = "914";
  const p2 = "367";
  const p3 = "087";

  if (telContainer) {
    const link = document.createElement("a");
    link.href = `tel:+351${p1}${p2}${p3}`;
    link.style.color = "inherit";
    link.innerText = `${p1} ${p2} ${p3}`;
    telContainer.appendChild(link);
  }

  // 2. LÓGICA DO MODAL WHATSAPP
  const openBtn = document.getElementById("openWaModal");
  const closeBtn = document.getElementById("closeWaModal");
  const modal = document.getElementById("waModal");
  const sendBtn = document.getElementById("waSendBtn");
  const options = document.querySelectorAll(".tactic-opt");

  if (!modal) return;

  // Base de dados de números protegida e fragmentada
  const numAntD = "911";
  const numAntE = "933";
  const numAntF = "140";
  const COACH_PHONES = {
    francisco: "351" + p1 + p2 + p3,
    bogas: "351" + p1 + p2 + p3,
    antonio: "351" + numAntD + numAntE + numAntF,
  };

  let selectedPhone = null;
  let selectedMsg = null;

  // Função para fechar o modal
  const closeModal = () => {
    modal.classList.add("is-hidden");
    options.forEach((opt) => opt.classList.remove("is-selected"));
    if (sendBtn) sendBtn.disabled = true;
    selectedPhone = null;
  };

  // Eventos de Abrir/Fechar
  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modal.classList.remove("is-hidden");
    });
  }

  if (closeBtn) closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Lógica de Seleção das Turmas
  options.forEach((button) => {
    button.addEventListener("click", () => {
      // Limpa seleções anteriores
      options.forEach((opt) => opt.classList.remove("is-selected"));
      button.classList.add("is-selected");

      // Vai buscar o número à lista segura pelo "data-coach"
      const coachKey = button.getAttribute("data-coach");
      selectedPhone = COACH_PHONES[coachKey];
      selectedMsg = button.getAttribute("data-msg");

      if (sendBtn) sendBtn.disabled = false;
    });
  });

  // Ação Final: Abrir WhatsApp
  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      if (!selectedPhone) return;

      const url = `https://wa.me/${selectedPhone}?text=${encodeURIComponent(selectedMsg)}`;
      window.open(url, "_blank");
      closeModal();
    });
  }
});
