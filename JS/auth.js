/* JS/auth.js - SESSÃO DOS TREINADORES (Supabase Auth) */
import { supabase } from "./supabase.js";

export async function executarLogout() {
  await supabase.auth.signOut();
  localStorage.clear();
  window.location.replace("login.html");
}

// Nome do treinador vem da base de dados (tabela treinadores), não do email.
export async function obterNomeTreinador() {
  const { data, error } = await supabase.rpc("meu_treinador");
  if (!error && data) {
    localStorage.setItem("bogas_treinador_nome", data);
    return data;
  }
  return localStorage.getItem("bogas_treinador_nome") || "Bogas";
}
