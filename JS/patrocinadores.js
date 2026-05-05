/* JS/patrocinadores.js - Animações Premium */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // 1. Remover o Blur quando as imagens carregam
  const images = document.querySelectorAll(".card-media img");
  images.forEach((img) => {
    const markLoaded = () => img.classList.add("loaded");
    if (img.complete && img.naturalHeight !== 0) {
      markLoaded();
    } else {
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markLoaded, { once: true });
    }
  });

  // 2. Animação de Entrada em Cascata (Staggered Fade-In)
  const grid = document.querySelector(".grid");
  const cards = document.querySelectorAll(".card");

  if (grid && cards.length > 0) {
    // Configurar o estado invisível inicial
    cards.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(30px)";
      card.style.transition =
        "opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    });

    // Observer para acionar a animação quando a grelha entra no ecrã
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Animar cada cartão com um atraso de 120ms entre eles
            cards.forEach((card, index) => {
              setTimeout(() => {
                card.style.opacity = "1";
                card.style.transform = "translateY(0)";
              }, index * 120);
            });

            // Parar de observar depois de animar
            observer.unobserve(grid);
          }
        });
      },
      { threshold: 0.1 },
    ); // Dispara quando 10% da grelha está visível

    observer.observe(grid);
  }

  // 3. 🥊 PROTEÇÃO ANTI-BOT DO WHATSAPP (Número Fragmentado)
  const waLink = document.getElementById("joinWaLink");

  if (waLink) {
    // Partimos o número em bocados para os robôs não o lerem
    const p1 = "911";
    const p2 = "933";
    const p3 = "140";
    const numeroCompleto = "351" + p1 + p2 + p3;
    const mensagem =
      "Boas! Quero saber as condições de patrocínio do Bogas Team Fight Center.";

    // Quando o utilizador clica, o JS monta o link e abre uma nova janela
    waLink.addEventListener("click", (e) => {
      e.preventDefault(); // Impede que a página salte para o topo devido ao href="#"
      window.open(
        `https://wa.me/${numeroCompleto}?text=${encodeURIComponent(mensagem)}`,
        "_blank",
      );
    });
  } // <-- 🥊 PORTA DO IF FECHADA!
}); // <-- 🥊 PORTA DO DOMContentLoaded FECHADA!
