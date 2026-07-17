/**
 * ping.js
 * Mantém o projeto do Supabase ativo através de um "ping" leve em background.
 */

const SUPABASE_URL = "https://lvtodcvtsetapgimkmtl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Tv4Hlj5CgW-ZglgDh9JqHQ_I_IQDPTm"; // Mantém a tua chave correta aqui

async function keepSupabaseAwake() {
  try {
    // Aponta agora para a tabela neutra de infraestrutura
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/sistema_ping?select=id&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    console.info("✅ Supabase Ping: Atividade registada na tabela de sistema.");
  } catch (error) {
    console.error("❌ Supabase Ping falhou:", error.message);
  }
}

keepSupabaseAwake();
