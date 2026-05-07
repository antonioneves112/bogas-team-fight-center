/* JS/login.js - Autenticação Treinador (Com Segurança Oficial Supabase) */

document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const SUPABASE_URL = "https://lvtodcvtsetapgimkmtl.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_Tv4Hlj5CgW-ZglgDh9JqHQ_I_IQDPTm";

  const supabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );

  // 🥊 1. VERIFICAÇÃO DE SEGURANÇA MÁXIMA (Verifica a Sessão Oficial e o Token)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // Se o Supabase confirmar que o token do Mestre é válido, entra direto!
    window.location.replace("dashboard.html");
    return; // Pára o resto do código
  }

  // 2. Lógica do Formulário de Login
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
        // 🥊 3. AUTENTICAÇÃO OFICIAL (Gera o Token JWT)
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

        // Identifica qual treinador entrou para o Dashboard saber a quem atribuir as turmas
        if (email.toLowerCase().includes("antonio")) {
          localStorage.setItem("bogas_treinador_nome", "António");
        } else {
          localStorage.setItem("bogas_treinador_nome", "Bogas");
        }

        // Mantemos a flag antiga apenas para compatibilidade visual na app
        localStorage.setItem("bogas_treinador_ativo", "true");

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
