/* JS/gateway.js - LÓGICA DA PÁGINA GATEWAY E INSTALADOR PWA */

// 1. Registo do Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((err) => console.error("Erro no SW:", err));
  });
}

// =========================================================================
// 🥊 LÓGICA TÁTICA DO BOTÃO DE INSTALAR A APP NO GATEWAY (SISTEMA DE SEMÁFORO)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  let eventoInstalacaoGuardado = null;
  const btnInstalar = document.getElementById("btnInstalarAppGateway");
  const iosModal = document.getElementById("ios-install-modal");
  const closeIosBtn = document.getElementById("close-ios-modal");
  const modalTitle = iosModal?.querySelector("h3");
  const modalP = iosModal?.querySelector("p");
  const modalOl = iosModal?.querySelector("ol");

  if (btnInstalar) {
    const estaNaApp =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    // Se já estamos na App, esconde o botão
    if (estaNaApp) {
      btnInstalar.style.display = "none";
    } else {
      btnInstalar.style.display = "inline-flex";
      btnInstalar.innerHTML =
        "<i class='bx bx-loader-alt bx-spin'></i> A analisar...";
      btnInstalar.style.opacity = "0.7";
    }

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (closeIosBtn && iosModal) {
      closeIosBtn.addEventListener("click", () =>
        iosModal.classList.add("hidden"),
      );
      iosModal.addEventListener("click", (e) => {
        if (e.target === iosModal) iosModal.classList.add("hidden");
      });
    }

    // Se for iOS, a Apple não tem auditoria automática
    if (isIOS && !estaNaApp) {
      btnInstalar.innerHTML =
        "<i class='bx bx-download bx-tada'></i> Instalar App";
      btnInstalar.style.opacity = "1";
    }

    // O SINAL VERDE DO GOOGLE CHROME
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      eventoInstalacaoGuardado = e;
      btnInstalar.innerHTML =
        "<i class='bx bx-download bx-tada'></i> Instalar App";
      btnInstalar.style.opacity = "1";
    });

    // SISTEMA DE DEFESA: Se passarem 6 segundos e o Chrome não der a chave (App já instalada)
    setTimeout(() => {
      if (!eventoInstalacaoGuardado && !isIOS && !estaNaApp) {
        btnInstalar.style.display = "none";
      }
    }, 6000);

    // Deteta quando a instalação termina e esconde logo o botão
    window.addEventListener("appinstalled", () => {
      btnInstalar.style.display = "none";
      eventoInstalacaoGuardado = null;
    });

    // O CLIQUE DO UTILIZADOR
    btnInstalar.addEventListener("click", async (e) => {
      e.preventDefault();

      // SE FOR iPHONE
      if (isIOS) {
        if (iosModal) {
          if (modalTitle)
            modalTitle.innerHTML =
              "Instalar no iPhone <i class='bx bxl-apple'></i>";
          if (modalP)
            modalP.innerHTML =
              "Para instalares a App Bogas Team no teu iPhone:";
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

      // SE O CHROME JÁ DEU O SINAL VERDE
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
      // SE CLICOU DEMASIADO RÁPIDO
      else {
        if (iosModal) {
          if (modalTitle)
            modalTitle.innerHTML = "Instalação <i class='bx bxl-android'></i>";
          if (btnInstalar.innerHTML.includes("analisar")) {
            if (modalP)
              modalP.innerHTML =
                "O Google Chrome ainda está a validar o sistema de segurança da App. Aguarda 2 a 3 segundos antes de clicar!";
            if (modalOl) modalOl.innerHTML = "";
          }
          iosModal.classList.remove("hidden");
        }
      }
    });
  }
});
