/* JS/home.js - Versão Final Unificada (Instalador PWA Sistema de Semáforo) */

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
// 🥊 LÓGICA TÁTICA DO BOTÃO DE INSTALAR A APP (SISTEMA DE SEMÁFORO)
// =========================================================================
let eventoInstalacaoGuardado = null;
const btnInstalar = document.getElementById("btnInstalarApp");

if (btnInstalar) {
  const estaNaApp =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone;

  // 1. Se já estamos na App, esconde. Se não, mostra em modo "Em Espera"
  if (estaNaApp) {
    btnInstalar.style.display = "none";
  } else {
    btnInstalar.style.display = "inline-flex";
    btnInstalar.innerHTML =
      "<i class='bx bx-loader-alt bx-spin'></i> A analisar...";
    btnInstalar.style.opacity = "0.7"; // Fica meio transparente
  }

  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const iosModal = document.getElementById("ios-install-modal");
  const closeIosBtn = document.getElementById("close-ios-modal");
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

  // Se for iOS, a Apple não tem auditoria automática, por isso fica logo pronto a usar
  if (isIOS && !estaNaApp) {
    btnInstalar.innerHTML =
      "<i class='bx bx-download bx-tada'></i> Instalar App";
    btnInstalar.style.opacity = "1";
  }

  // 2. O SINAL VERDE DO GOOGLE CHROME
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    eventoInstalacaoGuardado = e; // Recebemos a "Chave Mágica"!

    // Acorda o botão visualmente e mostra que está pronto!
    btnInstalar.innerHTML =
      "<i class='bx bx-download bx-tada'></i> Instalar App";
    btnInstalar.style.opacity = "1";
  });

  // 3. SISTEMA DE DEFESA: Se passarem 6 segundos e o Chrome não der a chave
  setTimeout(() => {
    if (!eventoInstalacaoGuardado && !isIOS && !estaNaApp) {
      btnInstalar.innerHTML = "<i class='bx bx-error-circle'></i> Instalar App";
      btnInstalar.style.opacity = "1";
    }
  }, 6000);

  // 4. O CLIQUE DO UTILIZADOR
  btnInstalar.addEventListener("click", async (e) => {
    e.preventDefault();

    // 🥊 SE FOR iPHONE
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

    // 🥊 SE O CHROME JÁ DEU O SINAL VERDE (Chave recebida)
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
    // 🥊 SE CLICOU DEMASIADO RÁPIDO OU HÁ BLOQUEIO REAL
    else {
      if (iosModal) {
        if (modalTitle)
          modalTitle.innerHTML = "Instalação <i class='bx bxl-android'></i>";

        // Clicou quando o botão ainda dizia "A analisar..."
        if (btnInstalar.innerHTML.includes("analisar")) {
          if (modalP)
            modalP.innerHTML =
              "O Google Chrome ainda está a validar o sistema de segurança da App. Aguarda 2 a 3 segundos antes de clicar!";
          if (modalOl) modalOl.innerHTML = "";
        }
        // Clicou depois dos 6 segundos (quando o botão assumiu o erro)
        else {
          if (modalP)
            modalP.innerHTML =
              "O teu navegador bloqueou o pop-up automático. Instala a aplicação através do menu oficial:";
          if (modalOl)
            modalOl.innerHTML = `
              <li>Clica nos <strong>3 pontinhos</strong> verticais no canto superior do ecrã.</li>
              <li>Seleciona <strong>"Instalar Aplicação"</strong> ou <strong>"Adicionar ao Ecrã Principal"</strong>.</li>
              <li>Confirma clicando em <strong>"Instalar"</strong>.</li>
            `;
        }
        iosModal.classList.remove("hidden");
      }
    }
  });
}
