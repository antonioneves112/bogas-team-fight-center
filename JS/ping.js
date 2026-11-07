/* JS/ping.js - Mantém o projeto do Supabase ativo com um pedido leve
   (a única tabela que o público pode ler: sistema_ping). */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

async function keepSupabaseAwake() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sistema_ping?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY },
    });
    if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
  } catch (error) {
    console.warn("Supabase Ping falhou:", error.message);
  }
}

keepSupabaseAwake();
