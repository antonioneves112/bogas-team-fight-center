/* JS/auth.js - GESTÃO DE SESSÃO REAL (Supabase Auth) */
import { supabase } from "./supabase.js";
import { mostrarAviso } from "./main.js";

export async function realizarLogin(email, password) {
  try {
    // 🥊 O GOLPE REAL: Autenticação oficial do Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) throw error;

    // Se chegou aqui, o Supabase guardou o Token (JWT) automaticamente nos cookies/localstorage
    localStorage.setItem("bogas_treinador_nome", "Mestre Bogas"); // Nome visual

    window.location.replace("dashboard.html");
  } catch (err) {
    console.error("Erro de Login:", err.message);
    mostrarAviso("Acesso Negado", "Email ou password incorretos.", "erro");
  }
}

export async function executarLogout() {
  await supabase.auth.signOut();
  localStorage.clear();
  window.location.replace("login.html");
}

export async function verificarSessao() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session; // Retorna a sessão ativa ou null
}
