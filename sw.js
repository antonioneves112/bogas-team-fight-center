// =========================================================================
// 🥊 MOTOR DA APP (SERVICE WORKER) - BOGAS TEAM - V14
// =========================================================================
// Mudar a versão força todos os telemóveis a descarregar o código novo.
const CACHE_NAME = "bogas-team-v117";

// Ficheiros essenciais da app (o load3.png de 1,1 MB saiu: não era usado em nenhuma página).
const ASSETS_TO_CACHE = [
  "./",
  "./dashboard.html",
  "./index.html",
  "./portal.html",
  "./login.html",
  "./CSS/theme.css",
  "./CSS/home.css",
  "./CSS/portal.css",
  "./CSS/dashboard.css",
  "./CSS/login.css",
  "./JS/config.js",
  "./JS/supabase.js",
  "./JS/helpers.js",
  "./JS/toast.js",
  "./JS/state.js",
  "./JS/ui.js",
  "./JS/auth.js",
  "./JS/main.js",
  "./JS/socios.js",
  "./JS/mensalidades.js",
  "./JS/pdfManager.js",
  "./JS/vendas.js",
  "./JS/estatisticas.js",
  "./JS/congelamentos.js",
  "./JS/estatisticas-calculos.js",
  "./CSS/estatisticas.css",
  "./CSS/vendas.css",
  "./JS/portal.js",
  "./JS/login.js",
  "./JS/registar-sw.js",
  "./JS/app-routing.js",
  "./img/icones/icon-192.png",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    // cache: "reload" -> vai sempre ao servidor (nunca guarda uma cópia antiga do browser)
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(ASSETS_TO_CACHE.map((url) => new Request(url, { cache: "reload" }))),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.url.includes("supabase.co") ||
    event.request.url.match(/\.(mp4|webm|ogg)$/i)
  )
    return;
  // JS/CSS/JSON: confirmar sempre com o servidor (cache "no-cache" -> 304 se não mudou).
  // Evita HTML novo com JavaScript antigo guardado no telemóvel.
  // (Pedidos de navegação não podem levar opções novas: seguem como estão.)
  const caminho = new URL(event.request.url).pathname;
  const pedido =
    event.request.mode !== "navigate" && /\.(js|css|json)$/i.test(caminho)
      ? new Request(event.request, { cache: "no-cache" })
      : event.request;

  event.respondWith(
    fetch(pedido)
      .then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const clone = res.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request)),
  );
});

// 🥊 RECEÇÃO DE NOTIFICAÇÕES (BLINDADO E AGRESSIVO)
self.addEventListener("push", (event) => {
  let titulo = "Bogas Team";
  let mensagem = "Nova mensagem recebida!";

  if (event.data) {
    try {
      const payload = event.data.json();
      titulo = payload.titulo || payload.title || titulo;
      mensagem =
        payload.mensagem || payload.body || payload.message || mensagem;
    } catch (e) {
      mensagem = event.data.text() || mensagem;
    }
  }

  const options = {
    body: mensagem,
    icon: "./img/icones/icon-192.png",
    badge: "./icone.png",
    vibrate: [200, 100, 200, 100, 200, 100, 200], // Vibração tática de alerta
    requireInteraction: true, // 🥊 NOVO: Obriga o pop-up a ficar no ecrã até ser fechado ou clicado!
    tag: "alerta-geral", // Agrupa as mensagens para não inundar o ecrã
    data: { url: "/portal.html" },
  };

  event.waitUntil(self.registration.showNotification(titulo, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((tabs) => {
        for (let tab of tabs) {
          if (tab.url.includes("portal.html") && "focus" in tab)
            return tab.focus();
        }
        if (clients.openWindow) return clients.openWindow("/portal.html");
      }),
  );
});

// =========================================================================
// 🥊 COMUNICAÇÃO DE VERSÃO COM A APP
// =========================================================================
self.addEventListener("message", (event) => {
  if (event.data && event.data.tipo === "PEDIR_VERSAO") {
    // Responde com o nome da Cache atual (ou podes escrever a versão à mão)
    event.source.postMessage({
      tipo: "RESPOSTA_VERSAO",
      // Se a tua variável se chamar de outra forma no topo do ficheiro, muda aqui:
      versao: typeof CACHE_NAME !== "undefined" ? CACHE_NAME : "v1.0.0",
    });
  }
});
