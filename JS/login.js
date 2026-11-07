/* JS/login.js - LOGIN DOS TREINADORES (Supabase Auth) */
import { supabase } from "./supabase.js";
import { mostrarAviso } from "./toast.js";
import { obterNomeTreinador } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Se já há sessão válida, entra direto.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    window.location.replace("dashboard.html");
    return;
  }

  // 2. Formulário de login
  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("emailInput");
  const passInput = document.getElementById("passInput");
  const submitBtn = document.querySelector(".login-btn");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> A verificar...";
    submitBtn.disabled = true;

    const repor = () => {
      submitBtn.innerHTML = originalBtnText;
      submitBtn.disabled = false;
    };

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passInput.value,
      });

      if (error) {
        mostrarAviso("Acesso negado", "Verifica o teu email e palavra-passe.", "erro");
        repor();
        return;
      }

      // O nome do treinador vem da tabela "treinadores" (já não do texto do email).
      await obterNomeTreinador();
      localStorage.setItem("bogas_treinador_ativo", "true");

      submitBtn.innerHTML = "<i class='bx bx-check'></i> Acesso Permitido";
      submitBtn.classList.add("is-active");
      setTimeout(() => window.location.replace("dashboard.html"), 500);
    } catch (err) {
      mostrarAviso("Erro de ligação", "Verifica a internet ou tenta novamente.", "erro");
      repor();
    }
  });
});
