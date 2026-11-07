/* JS/supabase.js - LIGAÇÃO À BASE DE DADOS (cliente único para todo o site) */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// O supabase-js NÃO lança exceções: devolve { data, error }.
// Esta função lança o erro, para que os try/catch funcionem e nunca
// apareça "Sucesso" quando a operação falhou.
export async function db(pedido) {
  const { data, error } = await pedido;
  if (error) throw error;
  return data;
}
