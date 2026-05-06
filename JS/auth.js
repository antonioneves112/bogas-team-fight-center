/* JS/auth.js - GESTÃO CENTRALIZADA DE SESSÃO E AUTENTICAÇÃO */
import { supabase } from "./supabase.js";

export async function executarLogout() {
  localStorage.removeItem("bogas_atleta_id");
  localStorage.removeItem("bogas_treinador_ativo");
  localStorage.removeItem("bogas_treinador_nome");

  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn("Aviso ao encerrar sessão no Supabase:", err);
  }

  window.location.replace("gateway.html");
}
