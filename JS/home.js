/* JS/home.js - Versão Final Unificada (Instalador PWA Blindado com Memória) */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // =========================================================================
  // 1. ANIMAÇÕES DE ENTRADA (CASCATA)
  // =========================================================================
  const animatedElements = document.querySelectorAll(".glass-panel, .card");
  const entranceObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.15 },
  );
  animatedElements.forEach((el) => entranceObserver.observe(el));

  // =========================================================================
  // 2. SENSOR DE FOCO NO SCROLL MOBILE
  // =========================================================================
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      if (window.innerWidth > 768) return;
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-scroll-focus", entry.isIntersecting);
      });
    },
    { rootMargin: "-30% 0px -30% 0px", threshold: 0.5 },
  );
  document
    .querySelectorAll(".card")
    .forEach((card) => scrollObserver.observe(card));

  // =========================================================================
  // 3. LÓGICA DO CARROSSEL DE BOAS-VINDAS (MODAL AUTOMÁTICO)
  // =========================================================================
  const modalWelcome = document.getElementById("modalWelcome");
  const btnFecharWelcome = document.getElementById("btnFecharWelcome");
  const slides = document.querySelectorAll(".carousel-slide");
  const dots = document.querySelectorAll(".dot");
  const btnNext = document.getElementById("btnNextSlide");
  const btnPrev = document.getElementById("btnPrevSlide");
  let currentSlide = 0;
  let autoSlideInterval;

  if (modalWelcome && !sessionStorage.getItem("welcomeShown")) {
    setTimeout(() => {
      modalWelcome.classList.remove("hidden");
      iniciarAutoSlide();
    }, 500);
    sessionStorage.setItem("welcomeShown", "true");
  }

  const irParaSlide = (index) => {
    slides.forEach((slide) => slide.classList.remove("active"));
    dots.forEach((dot) => dot.classList.remove("active"));

    currentSlide = index;
    if (currentSlide >= slides.length) currentSlide = 0;
    if (currentSlide < 0) currentSlide = slides.length - 1;

    slides[currentSlide].classList.add("active");
    dots[currentSlide].classList.add("active");
  };

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      irParaSlide(currentSlide + 1);
      resetAutoSlide();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      irParaSlide(currentSlide - 1);
      resetAutoSlide();
    });
  }

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      irParaSlide(index);
      resetAutoSlide();
    });
  });

  const iniciarAutoSlide = () => {
    autoSlideInterval = setInterval(() => {
      irParaSlide(currentSlide + 1);
    }, 5000);
  };

  const resetAutoSlide = () => {
    clearInterval(autoSlideInterval);
    iniciarAutoSlide();
  };

  const fecharModalWelcome = () => {
    if (modalWelcome) {
      modalWelcome.classList.add("hidden");
      clearInterval(autoSlideInterval);

      const videos = modalWelcome.querySelectorAll("video");
      videos.forEach((vid) => vid.pause());
    }
  };

  if (btnFecharWelcome) {
    btnFecharWelcome.addEventListener("click", fecharModalWelcome);
  }

  if (modalWelcome) {
    modalWelcome.addEventListener("click", (e) => {
      if (e.target === modalWelcome) fecharModalWelcome();
    });
  }
});
// =========================================================================
// 🥊 LÓGICA TÁTICA DO BOTÃO DE INSTALAR A APP (ALTA DISPONIBILIDADE)
// =========================================================================
let eventoInstalacaoGuardado;
const btnInstalar = document.getElementById("btnInstalarApp");

if (btnInstalar) {
  // 1. Verifica se JÁ ESTAMOS dentro da app instalada
  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  // 🥊 DEFESA ABSOLUTA: Se já está na App, esconde. SE NÃO, MOSTRA SEMPRE!
  if (estaNaApp) {
    btnInstalar.style.display = "none";
  } else {
    btnInstalar.style.display = "inline-flex"; // Garante que NUNCA desaparece no site
  }

  const iosModal = document.getElementById("ios-install-modal");
  const closeIosBtn = document.getElementById("close-ios-modal");

  // Elementos internos do Modal para podermos alterar os textos dinamicamente
  const modalTitle = iosModal?.querySelector("h3");
  const modalP = iosModal?.querySelector("p");
  const modalOl = iosModal?.querySelector("ol");

  if (closeIosBtn && iosModal) {
    closeIosBtn.addEventListener("click", () =>
      iosModal.classList.add("hidden"),
    );
    iosModal.addEventListener("click", (e) => {
      if (e.target === iosModal) iosModal.classList.add("hidden");
    });
  }

  // 2. Ouve silenciosamente se o Google Chrome permite o Pop-up automático
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacaoGuardado = e; // Guarda a "chave" mágica
  });

  // 3. Quando o Mestre clica no botão verde
  btnInstalar.addEventListener("click", async (e) => {
    e.preventDefault();

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // 🥊 SE FOR iPHONE (Apresenta o Modal original)
    if (isIOS) {
      if (iosModal) {
        if (modalTitle)
          modalTitle.innerHTML =
            "Instalar no iPhone <i class='bx bxl-apple'></i>";
        if (modalP)
          modalP.innerHTML = "Para instalares a App Bogas Team no teu iPhone:";
        if (modalOl)
          modalOl.innerHTML = `
          <li>Toca no ícone de <strong>Partilhar</strong> <i class='bx bx-upload'></i> na barra inferior do Safari.</li>
          <li>Desliza para baixo e escolhe <strong>"Ecrã Principal"</strong> (Add to Home Screen).</li>
          <li>Clica em <strong>"Adicionar"</strong> no canto superior direito.</li>
        `;
        iosModal.classList.remove("hidden");
      }
      return;
    }

    // Se o Android DEIXOU mostrar o Pop-up automático oficial:
    if (eventoInstalacaoGuardado) {
      try {
        await eventoInstalacaoGuardado.prompt();
        const { outcome } = await eventoInstalacaoGuardado.userChoice;
        if (outcome === "accepted") {
          btnInstalar.style.display = "none";
        }
      } catch (erro) {
        console.error("Erro na instalação:", erro);
      } finally {
        eventoInstalacaoGuardado = null;
      }
    }
    // 🥊 SE O ANDROID BLOQUEOU O ATALHO MÁGICO (Apresenta o Modal adaptado para Android!)
    else {
      if (iosModal) {
        if (modalTitle)
          modalTitle.innerHTML =
            "Instalar no Android <i class='bx bxl-android'></i>";
        if (modalP)
          modalP.innerHTML =
            "O Chrome bloqueou o atalho temporariamente. Instala manualmente:";
        if (modalOl)
          modalOl.innerHTML = `
          <li>Clica nos <strong>3 pontinhos</strong> verticais (Menu) no canto superior direito do Chrome.</li>
          <li>Seleciona a opção <strong>"Instalar Aplicação"</strong> ou <strong>"Adicionar ao Ecrã Principal"</strong>.</li>
          <li>Confirma em <strong>"Instalar"</strong>.</li>
        `;
        iosModal.classList.remove("hidden");
      }
    }
  });
}
