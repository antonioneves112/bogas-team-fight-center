/* JS/supabase.js - LIGAÇÃO À BASE DE DADOS */

const SUPABASE_URL = "https://lvtodcvtsetapgimkmtl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Tv4Hlj5CgW-ZglgDh9JqHQ_I_IQDPTm";

// Exportamos o cliente para que outros ficheiros o possam usar
export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// Função para proteger a página
export async function verificarSessao() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace("login.html");
    return null;
  }
  return session;
}
