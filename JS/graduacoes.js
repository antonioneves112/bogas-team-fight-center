/* =========================================================
   JS/graduacoes.js - VERSÃO FINAL (PÁGINA ARRANCA LIMPA)
========================================================= */

// Dados organizados por Ano -> Eventos
const graduacoesDB = {
  2024: [
    {
      id: "maio2024",
      date: "26/05/2024",
      cover: "../img/graduacoes2024/grupo2024.jpg",
      gallery: [
        {
          type: "img",
          src: "../img/graduacoes2024/grupo2024.jpg",
          caption: "Exame Maio 2024",
        },
        {
          type: "img",
          src: "../img/graduacoes2024/aquecimento.jpg",
          caption: "Aquecimento",
        },
        {
          type: "img",
          src: "../img/graduacoes2024/alongamento.jpg",
          caption: "Alongamento",
        },
      ],
    },
  ],
  2025: [
    {
      id: "janeiro2025",
      date: "26/01/2025",
      cover: "../img/graduacoes2025Janeiro/graduacao2025.jpg",
      gallery: [
        {
          type: "img",
          src: "../img/graduacoes2025Janeiro/graduacao2025.jpg",
          caption: "Exame Janeiro 2025",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Janeiro/treinadores.jpg",
          caption: "Treinadores",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/aquecimento.mp4",
          caption: "Aquecimento",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/alongamento.mp4",
          caption: "Alongamento",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/tecnicas1.mp4",
          caption: "Técnicas",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/tecnicas3.mp4",
          caption: "Técnicas",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/tecnicaspares.mp4",
          caption: "Técnicas",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/tecnicaspares2.mp4",
          caption: "Técnicas",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/tecnicas.mp4",
          caption: "Avaliação",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/avaliacao1.mp4",
          caption: "Avaliação",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/avaliacao3.mp4",
          caption: "Avaliação",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/avaliacao4.mp4",
          caption: "Avaliação",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/avaliacao5.mp4",
          caption: "Avaliação",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Janeiro/avaliacao6.mp4",
          caption: "Avaliação",
        },
      ],
    },
    {
      id: "setembro2025",
      date: "28/09/2025",
      cover: "../img/graduacoes2025Setembro/principal.jpeg",
      gallery: [
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/principal.jpeg",
          caption: "Exame Setembro 2025",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/mestre.jpeg",
          caption: "Mestre",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/treinadores.jpeg",
          caption: "Treinadores",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/aquecimento.mp4",
          caption: "Aquecimento",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/alongamento.mp4",
          caption: "Alongamento",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/sombra.mp4",
          caption: "Sombra",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/tecnicas.mp4",
          caption: "Técnicas",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/sparring.mp4",
          caption: "Sparring",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/sparring 2.mp4",
          caption: "Sparring",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/abdominais.mp4",
          caption: "Abdominais",
        },
        {
          type: "video",
          src: "../img/graduacoes2025Setembro/entregas.mp4",
          caption: "Entregas",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/amarelas.jpeg",
          caption: "Entregas Faixas Amarelas",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/laranja.jpeg",
          caption: "Entregas Faixas Laranjas",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/verdes.jpeg",
          caption: "Entregas Faixas Verdes",
        },
        {
          type: "img",
          src: "../img/graduacoes2025Setembro/azuis.jpeg",
          caption: "Entregas Faixas Azuis",
        },
      ],
    },
  ],
  2026: [
    {
      id: "marco2026",
      date: "28/03/2026",
      cover: "../img/graduacoes2026marco/grupo.jpg",
      gallery: [
        {
          type: "img",
          src: "../img/graduacoes2026marco/grupo.jpg",
          caption: "Exame Março 2026",
        },
        {
          type: "img",
          src: "../img/graduacoes2026marco/amarelas.jpg",
          caption: "Faixas Amarelas",
        },
        {
          type: "img",
          src: "../img/graduacoes2026marco/laranjas.jpg",
          caption: "Faixas Laranjas",
        },
        {
          type: "img",
          src: "../img/graduacoes2026marco/verdes.jpg",
          caption: "Faixas Verdes",
        },
        {
          type: "img",
          src: "../img/graduacoes2026marco/azuis.jpg",
          caption: "Faixas Azuis",
        },
      ],
    },
  ],
};

// Variáveis Globais para o Modal
let currentGallery = [];
let currentIndex = 0;

// Elementos DOM
const yearButtons = document.querySelectorAll(".js-year");
const container = document.getElementById("yearEvents");
const titleEl = document.getElementById("yearTitle");
const modal = document.getElementById("gym-modal");

// Função para carregar eventos de um ano
function loadYear(year) {
  if (!yearButtons.length || !container) return;

  // A TÁTICA DO RESET VISUAL (HOVER):
  // Percorre todos os botões e liga/desliga o brilho Neon
  yearButtons.forEach((btn) => {
    if (btn.dataset.year === year) {
      btn.classList.add("is-active"); // Acende o botão selecionado
    } else {
      btn.classList.remove("is-active"); // Apaga os restantes
    }
  });

  // Limpar contentor e garantir que o título não tem texto injetado
  container.innerHTML = "";
  if (titleEl) {
    titleEl.textContent = "";
  }

  const events = graduacoesDB[year];

  // Se não houver eventos, para aqui e deixa a grelha limpa
  if (!events || events.length === 0) {
    return;
  }

  // Criar Cards Dinamicamente
  events.forEach((event) => {
    const btn = document.createElement("button");
    btn.className = "item card";
    btn.type = "button";

    btn.innerHTML = `
      <img src="${event.cover}" alt="Graduação ${event.date}" loading="lazy" />
      <div class="descricao">${event.date}</div>
    `;

    // AÇÃO DE CLIQUE: Abrir o Modal
    btn.addEventListener("click", () => {
      if (event.gallery && event.gallery.length > 0) {
        currentGallery = event.gallery;
        currentIndex = 0;
        updateModalContent();

        if (modal) {
          modal.classList.add("is-active");
          document.body.style.overflow = "hidden"; // Trava o scroll do fundo
        }
      }
    });

    container.appendChild(btn);
  });
}

// Inicializar a página (APENAS prepara os cliques, NÃO auto-carrega nada)
if (yearButtons.length > 0) {
  yearButtons.forEach((btn) => {
    btn.addEventListener("click", () => loadYear(btn.dataset.year));
  });
}

/* =========================================================
   LÓGICA DO MODAL (Navegação, Fechar Suave, Atualizar)
========================================================= */

window.closePremiumModal = function () {
  if (modal) {
    // 1. Oculta visualmente primeiro (Fade out suave igual à página espaço)
    modal.style.opacity = "0";

    // 2. Aguarda a animação acabar (300ms) para limpar e destravar a página
    setTimeout(() => {
      modal.classList.remove("is-active");
      modal.style.opacity = "1"; // Reset visual para a próxima vez que abrir
      document.body.style.overflow = "auto"; // Destrava o scroll

      // Pausar o vídeo ao fechar o modal
      const video = modal.querySelector("#modal-main-video");
      if (video) video.pause();
    }, 300);
  }
};

window.changeImage = function (step) {
  if (!currentGallery.length) return;
  currentIndex =
    (currentIndex + step + currentGallery.length) % currentGallery.length;
  updateModalContent();
};

function updateModalContent() {
  if (!currentGallery.length) return;

  const img = modal.querySelector("#modal-main-img");
  const video = modal.querySelector("#modal-main-video");
  const caption = modal.querySelector("#modal-caption");
  const item = currentGallery[currentIndex];

  if (!img || !video || !caption) return;

  // Reset visual (Fade out) para transição de media
  img.style.opacity = "0";
  video.style.opacity = "0";

  setTimeout(() => {
    // 1. Limpar fontes anteriores para não haver conflitos de áudio/carregamento
    img.style.display = "none";
    video.style.display = "none";
    video.pause();
    video.src = "";

    // 2. Verificar tipo de conteúdo
    if (item.type === "video") {
      video.src = item.src;
      video.style.display = "block";
      video.style.opacity = "1";
      video.load(); // Garante que o vídeo carrega o novo src
    } else {
      img.src = item.src;
      img.style.display = "block";
      img.style.opacity = "1";
    }

    caption.innerText = item.caption || "";
  }, 200);
}

// Suporte para Teclado (ESC e Setas)
document.addEventListener("keydown", (e) => {
  if (modal && modal.classList.contains("is-active")) {
    if (e.key === "Escape") closePremiumModal();
    if (e.key === "ArrowLeft") changeImage(-1);
    if (e.key === "ArrowRight") changeImage(1);
  }
});

// Fechar ao clicar fora da imagem/vídeo
modal?.addEventListener("click", (e) => {
  if (
    e.target === modal ||
    e.target.classList.contains("slider-wrapper") ||
    e.target.classList.contains("slider-stage") ||
    e.target.id === "modal-content-area"
  ) {
    closePremiumModal();
  }
});
