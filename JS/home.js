/* JS/home.js - Versão Final Unificada (Sintaxe Corrigida com iOS Fix) */

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

  // Mostrar o modal apenas 1 vez por sessão
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

      // Pára qualquer vídeo que esteja a tocar no carrossel
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
}); // 🥊 AQUI ESTÁ A PORTA CORRETAMENTE FECHADA!

// =========================================================================
// 🥊 LÓGICA TÁTICA DO BOTÃO DE INSTALAR A APP (PWA)
// =========================================================================
let eventoInstalacaoGuardado;
const btnInstalar = document.getElementById("btnInstalarApp");

if (btnInstalar) {
  // 1. Deteção: Vê se já está na App, se é telemóvel e se é Apple (iOS)
  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;
  const eTelemovel = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Elementos do Modal iOS
  const iosModal = document.getElementById("ios-install-modal");
  const closeIosBtn = document.getElementById("close-ios-modal");

  // Lógica para fechar o Modal iOS
  if (closeIosBtn && iosModal) {
    closeIosBtn.addEventListener("click", () =>
      iosModal.classList.add("hidden"),
    );
    iosModal.addEventListener("click", (e) => {
      if (e.target === iosModal) iosModal.classList.add("hidden");
    });
  }

  // 🥊 BLOQUEIO: Se já está na App OU se NÃO é telemóvel (é PC), esconde logo de raiz!
  if (estaNaApp || !eTelemovel) {
    btnInstalar.style.display = "none";
  } else {
    // Se é iOS, força o botão a aparecer logo (pois o beforeinstallprompt da Google não existe lá)
    if (isIOS) {
      btnInstalar.style.display = "inline-flex";
    } else {
      // Se é Android, espera pelo evento oficial da Google
      window.addEventListener("beforeinstallprompt", (e) => {
        e.preventDefault();
        eventoInstalacaoGuardado = e;
        btnInstalar.style.display = "inline-flex";
      });
    }

    btnInstalar.addEventListener("click", async (e) => {
      // Se for iPhone, previne bugs, abre o nosso Modal e pára a execução por aqui
      if (isIOS) {
        e.preventDefault();
        if (iosModal) iosModal.classList.remove("hidden");
        return;
      }

      // Se for Android, corre a lógica normal de instalação
      if (!eventoInstalacaoGuardado) {
        alert(
          "Mestre, a App já está pronta! Procura o ícone de instalação na barra de endereço!",
        );
        return;
      }

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
    });

    window.addEventListener("appinstalled", () => {
      btnInstalar.style.display = "none";
      eventoInstalacaoGuardado = null;
    });
  }
}
