/* JS/helpers.js - FERRAMENTAS GLOBAIS */

export function formatarNomeCurto(nomeCompleto) {
  if (!nomeCompleto) return "N/A";
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length <= 2) return nomeCompleto;
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

export function gerarMensagemWhatsApp(nomeCompleto, mesAnoReferencia) {
  const nome = formatarNomeCurto(nomeCompleto);
  const hoje = new Date().getDate();
  let mensagem = "";
  let mesTexto = mesAnoReferencia;

  if (mesAnoReferencia && mesAnoReferencia.includes("-")) {
    const [ano, mes] = mesAnoReferencia.split("-");
    const mesesPT_extenso = [
      "Janeiro",
      "Fevereiro",
      "Março",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro",
    ];
    mesTexto = `${mesesPT_extenso[parseInt(mes) - 1]} de ${ano}`;
  }

  if (hoje <= 8) {
    mensagem = `Caro(a) ${nome}. Esperamos que se encontre bem. Com o arranque de mais um mês, serve a presente mensagem para informar que a sua mensalidade referente a ${mesTexto} passou a constar como pendente. Agradecemos a sua habitual colaboração.`;
  } else if (hoje <= 15) {
    mensagem = `Caro(a) ${nome}. Verificamos nos nossos registos que a mensalidade de ${mesTexto} se encontra atualmente pendente. Solicitamos, por favor, a regularização da mesma com a maior brevidade possível.`;
  } else if (hoje <= 20) {
    mensagem = `Caro(a) ${nome}. Serve a presente mensagem para notificar que o prazo da mensalidade de ${mesTexto} expirou. Informamos que, a partir da presente data, será imputada uma coima suplementar de 20 € ao valor em dívida. Solicitamos a regularização hoje.`;
  } else {
    mensagem = `Caro(a) ${nome}. Serve a presente mensagem para comunicar que, face ao incumprimento prolongado da mensalidade de ${mesTexto}, o seu acesso aos treinos encontra-se oficialmente suspenso com efeitos imediatos.`;
  }
  return encodeURIComponent(mensagem);
}

/* Nova ferramenta para converter valores de texto em números */
export function extrairPreco(texto) {
  if (!texto) return 0;
  // Remove o símbolo € e substitui vírgulas por pontos
  const apenasNumeros = texto
    .toString()
    .replace("€", "")
    .replace(",", ".")
    .trim();
  return parseFloat(apenasNumeros) || 0;
}

// OTIMIZAÇÃO: Função de Debounce para atrasar a execução de eventos repetitivos
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export const MESES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// Escapa texto antes de o meter em innerHTML (impede injeção de HTML/JS).
export function escapeHTML(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c],
  );
}

// Data de HOJE no fuso do utilizador (toISOString usa UTC e, em Portugal no verão,
// entre a meia-noite e a 1h devolvia o dia anterior).
export function dataLocalISO(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function mesLocalISO(data = new Date()) {
  return dataLocalISO(data).slice(0, 7);
}

export function urlB64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Mostra/esconde um elemento através da classe .hidden (sem mexer em estilos no JS).
export function mostrar(el, visivel = true) {
  if (el) el.classList.toggle("hidden", !visivel);
}
