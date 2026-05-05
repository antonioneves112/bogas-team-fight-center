/* JS/login.js - Autenticação Treinador (Com Chave Permanente) */

// 🥊 1. ATALHO IMEDIATO: Bloqueia o ecrã e atira para o painel antes de pestanejar
if (localStorage.getItem("bogas_treinador_ativo") === "true") {
  window.location.replace("dashboard.html");
}

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const SUPABASE_URL = "https://lvtodcvtsetapgimkmtl.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Tv4Hlj5CgW-ZglgDh9JqHQ_I_IQDPTm";

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("emailInput");
  const passInput = document.getElementById("passInput");
  const submitBtn = document.querySelector(".login-btn");

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const originalBtnText = submitBtn.innerHTML;
      submitBtn.innerHTML =
        "<i class='bx bx-loader-alt bx-spin'></i> A verificar...";
      submitBtn.disabled = true;

      const email = emailInput.value.trim();
      const password = passInput.value;

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          alert("Acesso negado: Verifica o teu email e palavra-passe.");
          submitBtn.innerHTML = originalBtnText;
          submitBtn.disabled = false;
          return;
        }

        // 🥊 2. TRANCA A CHAVE PERMANENTE NO DISPOSITIVO (Igual aos atletas)
        localStorage.setItem("bogas_treinador_ativo", "true");

        // Identifica qual treinador entrou para o Dashboard saber a quem atribuir as turmas
        if (email.toLowerCase().includes("antonio")) {
          localStorage.setItem("bogas_treinador_nome", "António");
        } else {
          localStorage.setItem("bogas_treinador_nome", "Bogas");
        }

        submitBtn.innerHTML = "<i class='bx bx-check'></i> Acesso Permitido";
        submitBtn.classList.add("is-active");

        setTimeout(() => {
          window.location.replace("dashboard.html");
        }, 500);
      } catch (err) {
        alert("Erro de ligação. Verifica a internet ou tenta novamente.");
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
      }
    });
  }
});
